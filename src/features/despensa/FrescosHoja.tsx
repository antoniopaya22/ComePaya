import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Package, Plus, ScanBarcode, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Contador, Entrada, Opciones } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { hoyISO, sumarDias, type FechaISO } from "@/dominio/caducidad";
import { cantidadesRapidas, SECCIONES_FRESCOS, ubicacionHabitual } from "@/dominio/despensa";
import { datosBaseDe, emojiPara } from "@/dominio/ingredientes-base";
import { mismoNombre, puntuarBusqueda } from "@/dominio/texto";
import { formatearCantidad } from "@/dominio/unidades";
import { UBICACIONES, type Ingrediente, type ProductoConIngrediente, type Ubicacion } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, useIngredientes, useProductos } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { anadirLote, crearProducto } from "./altas";
import { SelectorCaducidad } from "./SelectorCaducidad";
import { avisarConDeshacer, deshacerDespensa } from "./deshacer";

/**
 * Alta rápida de lo que no tiene código de barras (fruta, verdura, carne, pescado, pan…):
 * se toca el ingrediente, se elige cuánto y listo. La hoja sigue abierta para meter la compra seguida.
 */
export function FrescosHoja({
  abierta,
  onAbiertaChange,
  onEnvasado,
}: {
  abierta: boolean;
  onAbiertaChange: (v: boolean) => void;
  /** Abre el alta de un producto envasado (con marca y sin escanear). */
  onEnvasado: () => void;
}) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: productos = [] } = useProductos();
  const hoy = hoyISO();

  const [seccion, setSeccion] = useState(SECCIONES_FRESCOS[0]);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<Ingrediente | { nombre: string; nuevo: true } | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("nevera");
  const [caducidad, setCaducidad] = useState<FechaISO | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Primero lo que ya habéis comprado alguna vez.
  const usados = useMemo(() => new Set(productos.filter((p) => !p.ean).map((p) => p.ingrediente_id)), [productos]);
  const visibles = useMemo(() => {
    const q = busqueda.trim();
    if (q) {
      return ingredientes
        .map((i) => [i, puntuarBusqueda(i.nombre, q)] as const)
        .filter(([, p]) => p > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([i]) => i);
    }
    return ingredientes
      .filter((i) => i.seccion_super === seccion)
      .sort((a, b) => Number(usados.has(b.id)) - Number(usados.has(a.id)) || a.nombre.localeCompare(b.nombre, "es"));
  }, [ingredientes, seccion, busqueda, usados]);
  const hayExacto = visibles.some((i) => mismoNombre(i.nombre, busqueda));

  const unidad = elegido && "id" in elegido ? elegido.unidad_base : (datosBaseDe(elegido?.nombre ?? "").unidad_base ?? "g");
  const rapidas = cantidadesRapidas(unidad);

  function elegir(i: Ingrediente | { nombre: string; nuevo: true }) {
    const base = "id" in i ? i : { ...datosBaseDe(i.nombre), nombre: i.nombre, seccion_super: datosBaseDe(i.nombre).seccion_super ?? seccion };
    const dias = "id" in i ? i.caducidad_defecto_dias : (base.caducidad_defecto_dias ?? null);
    setElegido(i);
    setCantidad(cantidadesRapidas("id" in i ? i.unidad_base : (base.unidad_base ?? "g")).inicial);
    setUbicacion(ubicacionHabitual(base.seccion_super ?? seccion, i.nombre));
    setCaducidad(dias ? sumarDias(hoy, dias) : null);
  }

  function cerrar(v: boolean) {
    if (!v) {
      setElegido(null);
      setBusqueda("");
    }
    onAbiertaChange(v);
  }

  /** El producto "a granel" del ingrediente (sin código ni marca); si no existe, se crea. */
  async function productoGenerico(ingrediente: Ingrediente | { nombre: string }): Promise<ProductoConIngrediente> {
    const id = "id" in ingrediente ? ingrediente.id : null;
    const existente =
      id && (productos.find((p) => p.ingrediente_id === id && !p.ean && mismoNombre(p.nombre, ingrediente.nombre)) ?? productos.find((p) => p.ingrediente_id === id && !p.ean && !p.marca));
    if (existente) return existente;
    const base = datosBaseDe(ingrediente.nombre);
    const seccionFinal = "id" in ingrediente ? ingrediente.seccion_super : (base.seccion_super ?? seccion);
    return crearProducto(
      hogar.id,
      { nombre: ingrediente.nombre, marca: null, ingrediente: ingrediente.nombre, unidad, seccion: seccionFinal, cantidadEnvase: null },
      ingredientes,
    );
  }

  async function guardar() {
    if (!elegido || cantidad <= 0) return;
    setGuardando(true);
    try {
      const producto = await productoGenerico(elegido);
      const { antes } = await anadirLote(hogar.id, producto, cantidad, ubicacion, caducidad);
      for (const clave of [claves.lotes, claves.productos, claves.ingredientes]) void queryClient.invalidateQueries({ queryKey: clave(hogar.id) });
      avisarConDeshacer(queryClient, hogar.id, `${formatearCantidad(cantidad, unidad)} de ${elegido.nombre.toLowerCase()}`, () => deshacerDespensa(hogar.id, antes));
      navigator.vibrate?.(15);
      // De vuelta a la cuadrícula para seguir con lo siguiente de la compra.
      setElegido(null);
      setBusqueda("");
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Hoja
      abierta={abierta}
      onAbiertaChange={cerrar}
      titulo={elegido ? elegido.nombre : "Añadir a la despensa"}
      descripcion={elegido ? undefined : "Fruta, verdura, carne, pescado o pan: sin código de barras."}
      pie={
        elegido ? (
          <Boton className="w-full" tamano="lg" onClick={guardar} disabled={guardando || cantidad <= 0}>
            <Check /> {guardando ? "Guardando…" : `Añadir ${formatearCantidad(cantidad, unidad)}`}
          </Boton>
        ) : undefined
      }
    >
      {elegido ? (
        <div className="flex flex-col gap-5">
          <button onClick={() => setElegido(null)} className="-mt-1 inline-flex h-9 items-center gap-1 self-start text-[15px] text-suave">
            <ArrowLeft className="size-4" /> Otro
          </button>
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-medium text-suave">Cuánto</p>
            <div className="flex flex-wrap gap-2">
              {rapidas.opciones.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setCantidad(o)}
                  className={cn(
                    "h-10 rounded-full border px-4 text-sm font-medium transition-colors active:scale-95",
                    cantidad === o ? "border-primario bg-primario text-primario-texto" : "border-borde bg-superficie",
                  )}
                >
                  {formatearCantidad(o, unidad)}
                </button>
              ))}
            </div>
            <Contador valor={cantidad} onChange={(v) => setCantidad(Math.max(0, v))} min={0} paso={rapidas.paso} sufijo={unidad} />
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-medium text-suave">Dónde</p>
            <Opciones opciones={UBICACIONES} valor={ubicacion} onChange={setUbicacion} />
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-medium text-suave">Caduca</p>
            <SelectorCaducidad valor={caducidad} onChange={setCaducidad} hoy={hoy} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
            <Entrada
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar o escribir (p. ej. mango)"
              className="h-11 rounded-full border-transparent bg-superficie-2 pl-10"
              type="search"
            />
          </div>

          {!busqueda.trim() && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
              {SECCIONES_FRESCOS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSeccion(s)}
                  className={cn("h-9 shrink-0 rounded-full px-4 text-sm font-medium", s === seccion ? "bg-primario text-primario-texto" : "bg-superficie-2 text-suave")}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <ul className="grid grid-cols-4 gap-2">
            {visibles.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => elegir(i)}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl bg-superficie-2 p-1 transition-transform active:scale-95"
                >
                  <span className="text-[28px] leading-none">{emojiPara(i.nombre, i.seccion_super, i.emoji)}</span>
                  <span className="line-clamp-2 text-center text-[11.5px] leading-tight">{i.nombre}</span>
                </button>
              </li>
            ))}
            {busqueda.trim() && !hayExacto && (
              <li>
                <button
                  onClick={() => elegir({ nombre: busqueda.trim().replace(/^./, (c) => c.toUpperCase()), nuevo: true })}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-primario/50 p-1 text-primario active:scale-95"
                >
                  <Plus className="size-6" />
                  <span className="line-clamp-2 text-center text-[11.5px] leading-tight">«{busqueda.trim()}»</span>
                </button>
              </li>
            )}
          </ul>

          <div className="flex flex-col gap-1 border-t border-borde/70 pt-2">
            <Link to="/escanear" onClick={() => cerrar(false)} className="flex h-12 items-center gap-3 text-[15px] font-medium">
              <ScanBarcode className="size-5 text-primario" /> Escanear un código de barras
            </Link>
            <button
              onClick={() => {
                cerrar(false);
                onEnvasado();
              }}
              className="flex h-12 items-center gap-3 text-left text-[15px] font-medium"
            >
              <Package className="size-5 text-primario" /> Producto envasado sin escanear
            </button>
          </div>
        </div>
      )}
    </Hoja>
  );
}
