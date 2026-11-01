import { Check, LoaderCircle, Package, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Contador, Entrada, Opciones, Selector } from "@/components/ui/campos";
import { hoyISO, sumarDias, type FechaISO } from "@/dominio/caducidad";
import { ingredienteSugerido } from "@/dominio/escaneo";
import { buscarIngrediente, seccionesDisponibles } from "@/dominio/lista";
import type { ProductoExterno } from "@/dominio/producto-externo";
import { envasesABase, formatearCantidad, UNIDADES_BASE, type UnidadBase } from "@/dominio/unidades";
import { llamarApi } from "@/lib/api";
import type { ProductoConIngrediente, Ubicacion } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { useIngredientes, useTiendas } from "../datos";
import { anadirLote, crearProducto } from "../despensa/altas";
import { SelectorCaducidad } from "../despensa/SelectorCaducidad";
import { useHogar } from "../hogar/HogarProvider";
import type { ResultadoMercadona } from "../../../api/_lib/mercadona";
import { FichaProducto } from "./FichaProducto";

export type Escaneado =
  | { ean: string; estado: "buscando" }
  | { ean: string; estado: "propio"; producto: ProductoConIngrediente }
  | { ean: string; estado: "externo"; externo: ProductoExterno }
  | { ean: string; estado: "desconocido"; aviso?: string };

export interface Guardado {
  ean: string;
  loteId: string;
  producto: ProductoConIngrediente;
  envases: number;
}

/**
 * Contenido del panel inferior del escáner (§7.2): producto conocido → cantidad y caducidad;
 * producto nuevo → además, a qué ingrediente corresponde y cuánto trae el envase.
 */
export function PanelEscaneo({
  escaneado,
  ubicacion,
  envasesExtra,
  onGuardado,
}: {
  escaneado: Escaneado;
  ubicacion: Ubicacion;
  /** Veces que se ha vuelto a escanear este producto con el panel abierto. */
  envasesExtra: number;
  onGuardado: (guardado: Guardado) => void;
}) {
  const { hogar } = useHogar();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: tiendas = [] } = useTiendas();
  const hoy = hoyISO();

  const externo = escaneado.estado === "externo" ? escaneado.externo : null;
  const propio = escaneado.estado === "propio" ? escaneado.producto : null;

  const [envases, setEnvases] = useState(1);
  const [caducidad, setCaducidad] = useState<FechaISO | null>(null);
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [ingrediente, setIngrediente] = useState("");
  const [unidad, setUnidad] = useState<UnidadBase>("ud");
  const [envase, setEnvase] = useState("");
  const [seccion, setSeccion] = useState("Otros");
  const [mercadona, setMercadona] = useState<ResultadoMercadona | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setEnvases(1);
    setMercadona(null);
    if (propio) {
      const dias = propio.caducidad_habitual_dias ?? propio.ingrediente.caducidad_defecto_dias;
      setCaducidad(dias ? sumarDias(hoy, dias) : null);
      return;
    }
    const base = externo?.nombre ?? "";
    const sugerido = base ? ingredienteSugerido(base, externo?.marca ?? null) : "";
    const existente = sugerido ? buscarIngrediente(sugerido, ingredientes) : null;
    setNombre(base);
    setMarca(externo?.marca ?? "");
    setIngrediente(existente?.nombre ?? sugerido);
    setUnidad(existente?.unidad_base ?? externo?.unidad_envase ?? "ud");
    setEnvase(externo?.cantidad_envase ? String(externo.cantidad_envase) : "");
    setSeccion(existente?.seccion_super ?? "Otros");
    setCaducidad(existente?.caducidad_defecto_dias ? sumarDias(hoy, existente.caducidad_defecto_dias) : null);
    // Se inicializa al cambiar de código escaneado.
  }, [escaneado.ean, escaneado.estado]);

  useEffect(() => {
    if (envasesExtra > 0) setEnvases((v) => v + 1);
  }, [envasesExtra]);

  function elegirMercadona(r: ResultadoMercadona) {
    setMercadona(r);
    setNombre(r.nombre);
    setMarca(r.marca ?? "");
    const sugerido = ingredienteSugerido(r.nombre, r.marca);
    const existente = buscarIngrediente(sugerido, ingredientes);
    setIngrediente(existente?.nombre ?? sugerido);
    if (r.unidad_envase) setUnidad(existente?.unidad_base ?? r.unidad_envase);
    if (r.cantidad_envase) setEnvase(String(r.cantidad_envase));
  }

  const existente = !propio && ingrediente.trim() ? buscarIngrediente(ingrediente, ingredientes) : null;
  const unidadFinal = propio?.ingrediente.unidad_base ?? existente?.unidad_base ?? unidad;
  const envaseNumero = Number(envase.replace(",", ".")) || null;
  const faltaEnvase = !propio && unidadFinal !== "ud" && !envaseNumero;
  const listo = envases > 0 && (propio || (nombre.trim() && ingrediente.trim() && !faltaEnvase));
  const secciones = seccionesDisponibles(tiendas[0]?.orden_secciones ?? [], ingredientes.map((i) => i.seccion_super));

  async function guardar() {
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      const producto =
        propio ??
        (await crearProducto(
          hogar.id,
          {
            nombre,
            marca: marca || null,
            ingrediente,
            unidad: unidadFinal,
            seccion,
            cantidadEnvase: envaseNumero,
            ean: escaneado.ean,
            externo,
            fotoUrl: mercadona?.foto_url,
            mercadonaId: mercadona?.mercadona_id,
          },
          ingredientes,
        ));
      if (mercadona) {
        // Que el próximo hogar que escanee este código lo encuentre ya (caché compartida).
        llamarApi("/api/mercadona", {
          method: "POST",
          body: JSON.stringify({ ean: escaneado.ean, mercadona_id: mercadona.mercadona_id }),
        }).catch(() => {});
      }
      const loteId = await anadirLote(hogar.id, producto, envasesABase(envases, producto.cantidad_envase), ubicacion, caducidad, "Escaneo");
      onGuardado({ ean: escaneado.ean, loteId, producto, envases });
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  if (escaneado.estado === "buscando") {
    return (
      <div className="flex items-center gap-2 py-8 text-suave">
        <LoaderCircle className="size-5 animate-spin" /> Buscando {escaneado.ean}…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {propio ? (
        <div className="flex items-center gap-3">
          {propio.foto_url ? (
            <img src={propio.foto_url} alt="" className="size-16 shrink-0 rounded-xl bg-white object-contain" />
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-superficie-2 text-suave">
              <Package className="size-6" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold">{propio.nombre}</p>
            <p className="text-sm text-suave">
              {[propio.marca, propio.cantidad_envase && formatearCantidad(propio.cantidad_envase, propio.ingrediente.unidad_base)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      ) : externo ? (
        <FichaProducto producto={externo} compacta />
      ) : (
        <BuscadorMercadona ean={escaneado.ean} aviso={escaneado.estado === "desconocido" ? escaneado.aviso : undefined} elegido={mercadona} onElegir={elegirMercadona} />
      )}

      {!propio && (
        <div className="flex flex-col gap-3 rounded-2xl border border-borde p-3">
          {!externo && (
            <div className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Nombre">
                <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del producto" />
              </Campo>
              <Campo etiqueta="Marca">
                <Entrada value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Opcional" />
              </Campo>
            </div>
          )}
          <Campo etiqueta="Ingrediente" ayuda={existente ? `Ya existe: se usará «${existente.nombre}».` : "Nuevo: lo que piden las recetas."}>
            <Entrada list="escaner-ingredientes" value={ingrediente} onChange={(e) => setIngrediente(e.target.value)} />
            <datalist id="escaner-ingredientes">
              {ingredientes.map((i) => (
                <option key={i.id} value={i.nombre} />
              ))}
            </datalist>
          </Campo>
          {!existente && (
            <div className="grid grid-cols-[auto_1fr] items-end gap-2">
              <Opciones opciones={UNIDADES_BASE.map((u) => ({ valor: u.valor, etiqueta: u.valor }))} valor={unidad} onChange={setUnidad} className="[&_button]:h-11" />
              <Selector value={seccion} onChange={(e) => setSeccion(e.target.value)} aria-label="Sección del súper">
                {secciones.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Selector>
            </div>
          )}
          <Campo etiqueta={`Contenido del envase (${unidadFinal})${unidadFinal === "ud" ? " · opcional" : ""}`}>
            <Entrada inputMode="decimal" value={envase} onChange={(e) => setEnvase(e.target.value)} placeholder={unidadFinal === "ud" ? "1" : "400"} className={cn(faltaEnvase && "border-peligro")} />
          </Campo>
        </div>
      )}

      <Campo etiqueta="Cantidad">
        <Contador valor={envases} onChange={setEnvases} min={1} />
      </Campo>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-suave">Caducidad</span>
        <SelectorCaducidad valor={caducidad} onChange={setCaducidad} hoy={hoy} />
      </div>
      <Boton tamano="lg" onClick={guardar} disabled={!listo || guardando}>
        <Check /> {guardando ? "Guardando…" : "Añadir a la despensa"}
      </Boton>
    </div>
  );
}

function BuscadorMercadona({
  ean,
  aviso,
  elegido,
  onElegir,
}: {
  ean: string;
  aviso?: string;
  elegido: ResultadoMercadona | null;
  onElegir: (r: ResultadoMercadona) => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoMercadona[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function buscar() {
    if (texto.trim().length < 2) return;
    setBuscando(true);
    try {
      const respuesta = await llamarApi(`/api/mercadona?q=${encodeURIComponent(texto.trim())}`);
      setResultados(respuesta.ok ? await respuesta.json() : []);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-suave">
        {aviso ?? `El código ${ean} no está en Open Food Facts.`} Búscalo en Mercadona o escribe sus datos.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar en Mercadona" type="search" />
        <Boton type="submit" variante="secundario" tamano="icono" aria-label="Buscar en Mercadona" disabled={buscando}>
          {buscando ? <LoaderCircle className="animate-spin" /> : <Search />}
        </Boton>
      </form>
      {resultados && !resultados.length && <p className="text-sm text-suave">Sin resultados.</p>}
      {resultados && resultados.length > 0 && (
        <ul className="flex max-h-56 flex-col overflow-y-auto">
          {resultados.map((r) => (
            <li key={r.mercadona_id}>
              <button
                onClick={() => onElegir(r)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left", elegido?.mercadona_id === r.mercadona_id ? "bg-primario-suave" : "hover:bg-superficie-2")}
              >
                {r.foto_url ? <img src={r.foto_url} alt="" className="size-10 rounded-lg bg-white object-contain" /> : <span className="size-10 rounded-lg bg-superficie-2" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.nombre}</span>
                  <span className="block text-xs text-suave">
                    {[r.envase_texto, r.precio && `${r.precio.toFixed(2).replace(".", ",")} €`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
