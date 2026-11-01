import { ChevronDown, ChevronRight, Library, Package, Plus, Refrigerator, ScanBarcode, Search, Snowflake, TriangleAlert, Warehouse } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";
import { Cabecera, Etiqueta, ListaEsqueleto, Tarjeta, Vacio } from "@/components/ui/varios";
import { describirCaducidad, estadoCaducidad, etiquetaCaducidad, hoyISO } from "@/dominio/caducidad";
import { agruparPorProducto, type GrupoLotes } from "@/dominio/despensa";
import { emojiPara } from "@/dominio/ingredientes-base";
import { normalizar } from "@/dominio/texto";
import { formatearLote } from "@/dominio/unidades";
import { UBICACIONES, type LoteConProducto, type Ubicacion } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { useLotes } from "../datos";
import { NuevoLoteHoja } from "./NuevoLoteHoja";
import { RacionesCongeladas } from "./RacionesCongeladas";
import { RetirarLoteHoja } from "./RetirarLoteHoja";

const ICONOS: Record<Ubicacion, typeof Refrigerator> = { nevera: Refrigerator, congelador: Snowflake, despensa: Warehouse };

export function DespensaPage() {
  const { data: lotes, isPending } = useLotes();

  const [filtro, setFiltro] = useState<Ubicacion | "todo">("todo");
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [retirando, setRetirando] = useState<LoteConProducto | null>(null);
  const hoy = hoyISO();

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return (lotes ?? []).filter(
      (l) =>
        (filtro === "todo" || l.ubicacion === filtro) &&
        (!texto ||
          normalizar(`${l.producto.nombre} ${l.producto.marca ?? ""} ${l.producto.ingrediente.nombre}`).includes(texto)),
    );
  }, [lotes, filtro, busqueda]);

  const grupos = useMemo(() => agruparPorProducto(visibles), [visibles]);
  const urgentes = (lotes ?? []).filter((l) => ["caducado", "pronto"].includes(estadoCaducidad(l.fecha_caducidad, hoy)));
  const cuenta = (u: Ubicacion) => (lotes ?? []).filter((l) => l.ubicacion === u).length;

  return (
    <>
      <Cabecera
        titulo="Despensa"
        subtitulo={lotes ? `${new Set(lotes.map((l) => l.producto_id)).size} productos en casa` : undefined}
        accion={
          <div className="flex gap-2">
            <Boton asChild variante="fantasma" tamano="icono-sm" aria-label="Todos los productos" title="Todos los productos">
              <Link to="/productos">
                <Library />
              </Link>
            </Boton>
            <Boton asChild variante="secundario" tamano="sm">
              <Link to="/escanear">
                <ScanBarcode /> Escanear
              </Link>
            </Boton>
            <Boton tamano="sm" className="hidden md:inline-flex" onClick={() => setNuevo(true)}>
              <Plus /> Añadir
            </Boton>
          </div>
        }
      />

      <div className="flex flex-col gap-4 px-4 md:px-0">
        {urgentes.length > 0 && (
          <Tarjeta className="flex items-center gap-3 border-aviso/30 bg-aviso-suave p-3.5 text-aviso">
            <TriangleAlert className="size-5 shrink-0" />
            <p className="text-sm font-medium">
              {urgentes.length === 1
                ? `${urgentes[0].producto.nombre}: ${describirCaducidad(urgentes[0].fecha_caducidad, hoy).toLowerCase()}`
                : `${urgentes.length} productos caducados o a punto de caducar`}
            </p>
          </Tarjeta>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en casa" className="pl-10" type="search" />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {([{ valor: "todo", etiqueta: "Todo" }, ...UBICACIONES] as const).map((u) => {
            const activo = filtro === u.valor;
            return (
              <button
                key={u.valor}
                onClick={() => setFiltro(u.valor)}
                className={cn("relative h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors", activo ? "text-primario-texto" : "bg-superficie-2 text-suave")}
              >
                {activo && <motion.span layoutId="filtro-ubicacion" className="absolute inset-0 rounded-full bg-primario" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">
                  {u.etiqueta}
                  {u.valor !== "todo" && lotes ? ` · ${cuenta(u.valor)}` : ""}
                </span>
              </button>
            );
          })}
        </div>

        {isPending ? (
          <ListaEsqueleto />
        ) : !lotes?.length ? (
          <Vacio icono={<Package />} titulo="La despensa está vacía">
            Escanea lo que tienes en la nevera, el congelador o los armarios, o añádelo a mano con el botón +.
          </Vacio>
        ) : !grupos.length ? (
          <p className="py-10 text-center text-sm text-suave">No hay nada que coincida.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {grupos.map((g) => (
                <motion.li key={g.producto_id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}>
                  <FilaProducto grupo={g} hoy={hoy} onLote={setRetirando} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        {(filtro === "todo" || filtro === "congelador") && <RacionesCongeladas />}
        {/* Hueco para que el botón flotante no tape la última fila. */}
        <div className="h-16 md:hidden" />
      </div>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setNuevo(true)}
        aria-label="Añadir a la despensa"
        className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-2xl bg-primario text-primario-texto shadow-lg shadow-primario/30 md:hidden"
      >
        <Plus className="size-6" />
      </motion.button>

      <NuevoLoteHoja abierta={nuevo} onAbiertaChange={setNuevo} />
      <RetirarLoteHoja lote={retirando} onCerrar={() => setRetirando(null)} />
    </>
  );
}

const tono = (estado: ReturnType<typeof estadoCaducidad>) => (estado === "caducado" ? "peligro" : estado === "pronto" ? "aviso" : "neutro");

/**
 * Un producto con todos sus lotes (§4.1): total y caducidad más próxima. Con un solo lote, tocar lo abre;
 * con varios, se despliegan para elegir cuál.
 */
function FilaProducto({ grupo, hoy, onLote }: { grupo: GrupoLotes<LoteConProducto>; hoy: string; onLote: (l: LoteConProducto) => void }) {
  const [abierto, setAbierto] = useState(false);
  const { producto } = grupo.lotes[0];
  const unidad = producto.ingrediente.unidad_base;
  const varios = grupo.lotes.length > 1;
  const estado = estadoCaducidad(grupo.proxima, hoy);

  return (
    <Tarjeta className="overflow-hidden">
      <button onClick={() => (varios ? setAbierto(!abierto) : onLote(grupo.lotes[0]))} className="flex w-full items-center gap-3 p-3 text-left transition-colors active:bg-superficie-2">
        {producto.foto_url ? (
          <img src={producto.foto_url} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain" loading="lazy" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-superficie-2 text-2xl">
            {emojiPara(producto.ingrediente.nombre, producto.ingrediente.seccion_super, producto.ingrediente.emoji)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{producto.nombre}</span>
          <span className="block truncate text-sm text-suave">
            {formatearLote(grupo.total, unidad, producto.cantidad_envase)}
            {producto.marca ? ` · ${producto.marca}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Etiqueta tono={tono(estado)}>{etiquetaCaducidad(grupo.proxima, hoy)}</Etiqueta>
          {varios && (
            <span className="flex items-center gap-0.5 text-xs text-suave">
              {grupo.lotes.length} lotes <ChevronDown className={cn("size-3.5 transition-transform", abierto && "rotate-180")} />
            </span>
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.ul initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-borde bg-superficie-2/50">
            {grupo.lotes.map((l) => {
              const Icono = ICONOS[l.ubicacion];
              return (
                <li key={l.id}>
                  <button onClick={() => onLote(l)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-superficie-2">
                    <Icono className="size-4 text-suave" />
                    <span className="flex-1">{formatearLote(l.cantidad, unidad, producto.cantidad_envase)}</span>
                    <Etiqueta tono={tono(estadoCaducidad(l.fecha_caducidad, hoy))}>{describirCaducidad(l.fecha_caducidad, hoy)}</Etiqueta>
                  </button>
                </li>
              );
            })}
            <li>
              <Link to={`/productos/${producto.id}`} className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-primario">
                Ver ficha <ChevronRight className="size-4" />
              </Link>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </Tarjeta>
  );
}
