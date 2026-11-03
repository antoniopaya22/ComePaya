import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Contador, Entrada, Opciones, Selector } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { hoyISO, sumarDias, type FechaISO } from "@/dominio/caducidad";
import { buscarIngrediente, seccionesDisponibles } from "@/dominio/lista";
import { normalizar } from "@/dominio/texto";
import { envasesABase, formatearCantidad, UNIDADES_BASE, type UnidadBase } from "@/dominio/unidades";
import { UBICACIONES, type ProductoConIngrediente, type Ubicacion } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useIngredientes, useProductos, useTiendas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { anadirLote, crearProducto } from "./altas";
import { SelectorCaducidad } from "./SelectorCaducidad";
import { avisarConDeshacer, deshacerDespensa } from "./deshacer";

interface ProductoNuevo {
  nombre: string;
  marca: string;
  ingrediente: string;
  unidad: UnidadBase;
  seccion: string;
  envase: string;
}

export function NuevoLoteHoja({
  abierta,
  onAbiertaChange,
  productoInicial,
}: {
  abierta: boolean;
  onAbiertaChange: (v: boolean) => void;
  /** Abre el panel con este producto ya elegido (desde su ficha). */
  productoInicial?: ProductoConIngrediente;
}) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: productos = [] } = useProductos();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: tiendas = [] } = useTiendas();
  const hoy = hoyISO();

  const [busqueda, setBusqueda] = useState("");
  const [producto, setProducto] = useState<ProductoConIngrediente | null>(null);
  const [nuevo, setNuevo] = useState<ProductoNuevo | null>(null);
  const [envases, setEnvases] = useState(1);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("nevera");
  const [caducidad, setCaducidad] = useState<FechaISO | null>(null);
  const [guardando, setGuardando] = useState(false);

  const sugerencias = useMemo(() => {
    const texto = normalizar(busqueda);
    if (!texto) return productos.slice(0, 6);
    return productos.filter((p) => normalizar(`${p.nombre} ${p.marca ?? ""}`).includes(texto)).slice(0, 6);
  }, [busqueda, productos]);

  const ingredienteExistente = nuevo ? buscarIngrediente(nuevo.ingrediente, ingredientes) : null;
  const unidad: UnidadBase = producto?.ingrediente.unidad_base ?? ingredienteExistente?.unidad_base ?? nuevo?.unidad ?? "ud";
  const envaseNuevo = nuevo ? Number(nuevo.envase.replace(",", ".")) || null : null;
  const cantidadEnvase = producto ? producto.cantidad_envase : envaseNuevo;
  const secciones = seccionesDisponibles(tiendas[0]?.orden_secciones ?? [], ingredientes.map((i) => i.seccion_super));

  function reiniciar() {
    setBusqueda("");
    setProducto(null);
    setNuevo(null);
    setEnvases(1);
    setCaducidad(null);
  }

  useEffect(() => {
    if (abierta && productoInicial) elegir(productoInicial);
    // Solo al abrir: después manda lo que el usuario elija.
  }, [abierta]);

  function elegir(p: ProductoConIngrediente) {
    setProducto(p);
    setNuevo(null);
    // Caducidad preseleccionada: la última usada para el producto o la habitual del ingrediente (§7.2).
    const dias = p.caducidad_habitual_dias ?? p.ingrediente.caducidad_defecto_dias;
    setCaducidad(dias ? sumarDias(hoy, dias) : null);
  }

  function empezarNuevo() {
    const nombre = busqueda.trim();
    setProducto(null);
    setNuevo({ nombre, marca: "", ingrediente: nombre, unidad: "g", seccion: secciones[0], envase: "" });
  }

  // Los productos medidos en g o ml necesitan el contenido del envase para guardar la cantidad en unidad base.
  const faltaEnvase = nuevo !== null && unidad !== "ud" && !envaseNuevo;
  const listo = (producto !== null || (nuevo !== null && nuevo.nombre.trim() && nuevo.ingrediente.trim() && !faltaEnvase)) && envases > 0;

  async function guardar() {
    if (!listo) return;
    setGuardando(true);
    try {
      const elegido =
        producto ??
        (nuevo &&
          (await crearProducto(
            hogar.id,
            {
              nombre: nuevo.nombre,
              marca: nuevo.marca || null,
              ingrediente: nuevo.ingrediente,
              unidad,
              seccion: nuevo.seccion,
              cantidadEnvase: envaseNuevo,
            },
            ingredientes,
          )));
      if (!elegido) return;
      const { antes } = await anadirLote(hogar.id, elegido, envasesABase(envases, elegido.cantidad_envase), ubicacion, caducidad);

      for (const clave of [claves.lotes, claves.productos, claves.ingredientes]) {
        queryClient.invalidateQueries({ queryKey: clave(hogar.id) });
      }
      avisarConDeshacer(queryClient, hogar.id, `${elegido.nombre} añadido`, () => deshacerDespensa(hogar.id, antes));
      reiniciar();
      onAbiertaChange(false);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Hoja
      abierta={abierta}
      onAbiertaChange={(v) => {
        if (!v) reiniciar();
        onAbiertaChange(v);
      }}
      titulo="Añadir a la despensa"
      pie={
        <Boton className="w-full" tamano="lg" onClick={guardar} disabled={!listo || guardando}>
          <Check /> {guardando ? "Guardando…" : "Añadir"}
        </Boton>
      }
    >
      <div className="flex flex-col gap-5">
        {producto ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-primario-suave p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{producto.nombre}</p>
              <p className="truncate text-sm text-suave">
                {[producto.marca, producto.ingrediente.nombre, producto.cantidad_envase && formatearCantidad(producto.cantidad_envase, unidad)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Boton variante="fantasma" tamano="sm" onClick={() => setProducto(null)}>
              Cambiar
            </Boton>
          </div>
        ) : nuevo ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-borde p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Producto nuevo</p>
              <Boton variante="fantasma" tamano="sm" onClick={() => setNuevo(null)}>
                Cancelar
              </Boton>
            </div>
            <Campo etiqueta="Nombre">
              <Entrada value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Tomate triturado" />
            </Campo>
            <Campo etiqueta="Marca (opcional)">
              <Entrada value={nuevo.marca} onChange={(e) => setNuevo({ ...nuevo, marca: e.target.value })} placeholder="Hacendado" />
            </Campo>
            <Campo
              etiqueta="Ingrediente"
              ayuda={
                ingredienteExistente
                  ? `Se usará «${ingredienteExistente.nombre}», que ya existe.`
                  : "Lo que piden las recetas. Varios productos pueden ser el mismo ingrediente."
              }
            >
              <Entrada
                list="ingredientes-existentes"
                value={nuevo.ingrediente}
                onChange={(e) => setNuevo({ ...nuevo, ingrediente: e.target.value })}
                placeholder="Tomate triturado"
              />
              <datalist id="ingredientes-existentes">
                {ingredientes.map((i) => (
                  <option key={i.id} value={i.nombre} />
                ))}
              </datalist>
            </Campo>
            {!ingredienteExistente && (
              <>
                <Campo etiqueta="Se mide en">
                  <Opciones opciones={UNIDADES_BASE} valor={nuevo.unidad} onChange={(u) => setNuevo({ ...nuevo, unidad: u })} />
                </Campo>
                <Campo etiqueta="Sección del súper">
                  <Selector value={nuevo.seccion} onChange={(e) => setNuevo({ ...nuevo, seccion: e.target.value })}>
                    {secciones.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Selector>
                </Campo>
              </>
            )}
            <Campo
              etiqueta={`Contenido del envase (${unidad})${unidad === "ud" ? " · opcional" : ""}`}
              ayuda={unidad === "ud" ? "Por ejemplo, 6 para una docena de media." : "Por ejemplo, 400 para una lata de 400 g."}
            >
              <Entrada inputMode="decimal" value={nuevo.envase} onChange={(e) => setNuevo({ ...nuevo, envase: e.target.value })} placeholder={unidad === "ud" ? "1" : "400"} />
            </Campo>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="¿Qué vas a guardar?" type="search" autoFocus />
            <ul className="flex flex-col">
              {sugerencias.map((p) => (
                <li key={p.id}>
                  <button onClick={() => elegir(p)} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-superficie-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.nombre}</span>
                      <span className="block truncate text-sm text-suave">{[p.marca, p.ingrediente.nombre].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {busqueda.trim() && (
              <Boton variante="secundario" onClick={empezarNuevo}>
                <Plus /> Crear «{busqueda.trim()}»
              </Boton>
            )}
          </div>
        )}

        {(producto || nuevo) && (
          <>
            <Campo etiqueta={cantidadEnvase && !(unidad === "ud" && cantidadEnvase === 1) ? "Envases" : "Cantidad"}>
              <Contador valor={envases} onChange={setEnvases} min={0.5} paso={1} sufijo={cantidadEnvase ? undefined : unidad} />
            </Campo>
            <Campo etiqueta="Dónde">
              <Opciones opciones={UBICACIONES} valor={ubicacion} onChange={setUbicacion} />
            </Campo>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-suave">Caducidad</span>
              <SelectorCaducidad valor={caducidad} onChange={setCaducidad} hoy={hoy} />
            </div>
          </>
        )}
      </div>
    </Hoja>
  );
}
