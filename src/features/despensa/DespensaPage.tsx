import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  Library,
  Package,
  Plus,
  Refrigerator,
  ScanBarcode,
  Search,
  Snowflake,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BarraApp, EnlaceBarra } from "@/components/BarraApp";
import { Fab } from "@/components/ui/fab";
import { PasarAUnidades } from "../productos/PasarAUnidades";
import { Menu, MenuContenido, MenuDisparador, MenuEtiqueta, MenuOpcion } from "@/components/ui/menu";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";
import { Etiqueta, ListaEsqueleto, Tarjeta, Vacio } from "@/components/ui/varios";
import { describirCaducidad, estadoCaducidad, etiquetaCaducidad, hoyISO } from "@/dominio/caducidad";
import { agruparPorProducto, describirQueda, organizarDespensa, type GrupoLotes, type OrdenDespensa } from "@/dominio/despensa";
import { EMOJI_SECCION, emojiPara } from "@/dominio/ingredientes-base";
import { normalizar } from "@/dominio/texto";
import { formatearLote } from "@/dominio/unidades";
import { UBICACIONES, type LoteConProducto, type Ubicacion } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { useLotes, useTiendas } from "../datos";
import { FrescosHoja } from "./FrescosHoja";
import { NuevoLoteHoja } from "./NuevoLoteHoja";
import { RacionesCongeladas } from "./RacionesCongeladas";
import { RetirarLoteHoja } from "./RetirarLoteHoja";

const ICONOS: Record<Ubicacion, typeof Refrigerator> = { nevera: Refrigerator, congelador: Snowflake, despensa: Warehouse };

const ORDENES: { valor: OrdenDespensa; etiqueta: string }[] = [
  { valor: "caducidad", etiqueta: "Caducidad" },
  { valor: "tipo", etiqueta: "Tipo de alimento" },
  { valor: "nombre", etiqueta: "Nombre" },
];
const CLAVE_ORDEN = "comepaya.orden-despensa";
const claseDesplegable =
  "flex h-9 items-center gap-1.5 rounded-full bg-superficie-2 px-3.5 text-sm font-medium text-suave outline-none focus-visible:ring-2 focus-visible:ring-primario data-[state=open]:bg-borde";

/** El orden elegido se recuerda en el dispositivo. */
function leerOrden(): OrdenDespensa {
  try {
    const guardado = localStorage.getItem(CLAVE_ORDEN);
    return ORDENES.some((o) => o.valor === guardado) ? (guardado as OrdenDespensa) : "caducidad";
  } catch {
    return "caducidad";
  }
}

export function DespensaPage() {
  const { data: lotes, isPending } = useLotes();

  const { data: tiendas = [] } = useTiendas();
  const [filtro, setFiltro] = useState<Ubicacion | "todo">("todo");
  const [tipo, setTipo] = useState<string | null>(null);
  const [orden, setOrden] = useState<OrdenDespensa>(() => leerOrden());
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [frescos, setFrescos] = useState(false);
  const [retirando, setRetirando] = useState<LoteConProducto | null>(null);
  const hoy = hoyISO();

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return (lotes ?? []).filter(
      (l) =>
        (filtro === "todo" || l.ubicacion === filtro) &&
        (!tipo || l.producto.ingrediente.seccion_super === tipo) &&
        (!texto || normalizar(`${l.producto.nombre} ${l.producto.marca ?? ""} ${l.producto.ingrediente.nombre}`).includes(texto)),
    );
  }, [lotes, filtro, tipo, busqueda]);

  const grupos = useMemo(() => agruparPorProducto(visibles), [visibles]);
  const organizado = useMemo(
    () => organizarDespensa(grupos, orden, (g) => g.lotes[0].producto.ingrediente.seccion_super, tiendas[0]?.orden_secciones),
    [grupos, orden, tiendas],
  );
  // Tipos de alimento que hay en casa, con cuántos productos de cada uno.
  const tipos = useMemo(() => {
    const cuenta = new Map<string, Set<string>>();
    for (const l of lotes ?? []) {
      const s = l.producto.ingrediente.seccion_super;
      cuenta.set(s, (cuenta.get(s) ?? new Set()).add(l.producto_id));
    }
    return organizarDespensa(
      [...cuenta.entries()].map(([seccion, productos]) => ({ seccion, n: productos.size, lotes: [{ producto: { nombre: seccion } }] })),
      "tipo",
      (t) => t.seccion,
      tiendas[0]?.orden_secciones,
    ).map((g) => g.grupos[0]);
  }, [lotes, tiendas]);

  function cambiarOrden(nuevo: OrdenDespensa) {
    setOrden(nuevo);
    try {
      localStorage.setItem(CLAVE_ORDEN, nuevo);
    } catch {
      // Sin almacenamiento se recuerda solo mientras la app está abierta.
    }
  }
  const urgentes = (lotes ?? []).filter((l) => ["caducado", "pronto"].includes(estadoCaducidad(l.fecha_caducidad, hoy)));
  const cuenta = (u: Ubicacion) => (lotes ?? []).filter((l) => l.ubicacion === u).length;

  return (
    <>
      <BarraApp
        titulo="Despensa"
        subtitulo={lotes ? `${new Set(lotes.map((l) => l.producto_id)).size} productos en casa` : undefined}
        acciones={
          <>
            <EnlaceBarra to="/productos" etiqueta="Todos los productos">
              <Library />
            </EnlaceBarra>
            <EnlaceBarra to="/escanear" etiqueta="Escanear">
              <ScanBarcode />
            </EnlaceBarra>
          </>
        }
        principal={
          <Boton tamano="sm" onClick={() => setFrescos(true)}>
            <Plus /> Añadir
          </Boton>
        }
      />

      <div className="flex flex-col gap-4 px-4 md:px-0">
        <PasarAUnidades />
        {urgentes.length > 0 && (
          <Tarjeta className="flex items-center gap-3 bg-aviso-suave p-3.5 text-aviso md:border-aviso/30">
            <TriangleAlert className="size-5 shrink-0" />
            <p className="text-sm font-medium">
              {urgentes.length === 1
                ? `${urgentes[0].producto.nombre}: ${describirCaducidad(urgentes[0].fecha_caducidad, hoy).toLowerCase()}`
                : `${urgentes.length} productos caducados o a punto de caducar`}
            </p>
          </Tarjeta>
        )}

        {/* Buscador y filtros quedan a mano al desplazar la lista. */}
        <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 flex flex-col gap-2.5 bg-fondo/90 px-4 py-2 backdrop-blur-xl md:top-16 md:mx-0 md:px-0">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
            <Entrada
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en casa"
              className="h-11 rounded-full border-transparent bg-superficie-2 pl-10 md:rounded-xl md:border-borde md:bg-superficie"
              type="search"
            />
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {([{ valor: "todo", etiqueta: "Todo" }, ...UBICACIONES] as const).map((u) => {
              const activo = filtro === u.valor;
              return (
                <button
                  key={u.valor}
                  onClick={() => setFiltro(u.valor)}
                  className={cn(
                    "relative h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                    activo ? "text-primario-texto" : "bg-superficie-2 text-suave",
                  )}
                >
                  {activo && (
                    <motion.span
                      layoutId="filtro-ubicacion"
                      className="absolute inset-0 rounded-full bg-primario"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative">
                    {u.etiqueta}
                    {u.valor !== "todo" && lotes ? ` · ${cuenta(u.valor)}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Menu>
              <MenuDisparador className={cn(claseDesplegable, tipo && "bg-primario-suave text-primario")}>
                {tipo ? `${EMOJI_SECCION[tipo] ?? "🧺"} ${tipo}` : "Todos los tipos"} <ChevronDown className="size-4" />
              </MenuDisparador>
              <MenuContenido align="start" className="max-h-[60dvh] overflow-y-auto">
                <MenuEtiqueta>Tipo de alimento</MenuEtiqueta>
                <MenuOpcion onSelect={() => setTipo(null)}>
                  <span className="flex-1">Todos</span>
                  {!tipo && <Check className="text-primario!" />}
                </MenuOpcion>
                {tipos.map((t) => (
                  <MenuOpcion key={t.seccion} onSelect={() => setTipo(t.seccion)}>
                    <span>{EMOJI_SECCION[t.seccion] ?? "🧺"}</span>
                    <span className="flex-1">{t.seccion}</span>
                    <span className="text-xs text-suave">{t.n}</span>
                    {tipo === t.seccion && <Check className="text-primario!" />}
                  </MenuOpcion>
                ))}
              </MenuContenido>
            </Menu>
            <Menu>
              <MenuDisparador className={cn(claseDesplegable, "ml-auto")} aria-label="Ordenar">
                <ArrowDownUp className="size-4" /> {ORDENES.find((o) => o.valor === orden)?.etiqueta}
              </MenuDisparador>
              <MenuContenido>
                <MenuEtiqueta>Ordenar por</MenuEtiqueta>
                {ORDENES.map((o) => (
                  <MenuOpcion key={o.valor} onSelect={() => cambiarOrden(o.valor)}>
                    <span className="flex-1">{o.etiqueta}</span>
                    {orden === o.valor && <Check className="text-primario!" />}
                  </MenuOpcion>
                ))}
              </MenuContenido>
            </Menu>
          </div>
        </div>

        {isPending ? (
          <ListaEsqueleto />
        ) : !lotes?.length ? (
          <Vacio icono={<Package />} titulo="La despensa está vacía">
            Escanea lo que tienes en la nevera, el congelador o los armarios, o añade fruta, verdura, carne o pan con «Añadir».
          </Vacio>
        ) : !grupos.length ? (
          <p className="py-10 text-center text-sm text-suave">No hay nada que coincida.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {organizado.map((bloque) => (
              <section key={bloque.seccion ?? "todo"} className="flex flex-col gap-1.5">
                {bloque.seccion && (
                  <h2 className="flex items-center justify-between px-1 text-[13px] font-semibold tracking-wide text-suave uppercase">
                    <span>
                      {EMOJI_SECCION[bloque.seccion] ?? "🧺"} {bloque.seccion}
                    </span>
                    <span className="font-medium">{bloque.grupos.length}</span>
                  </h2>
                )}
                <ul className="overflow-hidden rounded-2xl bg-superficie shadow-[0_1px_2px_rgb(0_0_0/0.04)] md:border md:border-borde [&>li+li]:border-t [&>li+li]:border-borde/70">
                  <AnimatePresence initial={false}>
                    {bloque.grupos.map((g) => (
                      <motion.li
                        key={g.producto_id}
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                      >
                        <FilaProducto grupo={g} hoy={hoy} onLote={setRetirando} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        )}

        {(filtro === "todo" || filtro === "congelador") && <RacionesCongeladas />}
        {/* Hueco para que el botón flotante no tape la última fila. */}
        <div className="h-16 md:hidden" />
      </div>

      <Fab icono={<Plus />} onClick={() => setFrescos(true)}>
        Añadir
      </Fab>

      <FrescosHoja abierta={frescos} onAbiertaChange={setFrescos} onEnvasado={() => setNuevo(true)} />
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
  const empezado = grupo.lotes.find((l) => l.abierto_en);
  const queda = empezado ? describirQueda(empezado.cantidad, producto.cantidad_envase) : null;

  return (
    <div>
      <button
        onClick={() => (varios ? setAbierto(!abierto) : onLote(grupo.lotes[0]))}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-superficie-2"
      >
        {producto.foto_url ? (
          <img src={producto.foto_url} alt="" className="size-11 shrink-0 rounded-xl bg-white object-contain" loading="lazy" />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-superficie-2 text-2xl">
            {emojiPara(producto.ingrediente.nombre, producto.ingrediente.seccion_super, producto.ingrediente.emoji)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{producto.nombre}</span>
          <span className="block truncate text-[13.5px] text-suave">
            {formatearLote(grupo.total, unidad, producto.cantidad_envase)}
            {empezado && <span className="text-aviso"> · empezado{queda ? `, ${queda}` : ""}</span>}
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
          <motion.ul
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-borde/70 bg-superficie-2/50"
          >
            {grupo.lotes.map((l) => {
              const Icono = ICONOS[l.ubicacion];
              return (
                <li key={l.id}>
                  <button
                    onClick={() => onLote(l)}
                    className="flex min-h-12 w-full items-center gap-3 pr-4 pl-[4.25rem] text-left text-[15px] active:bg-superficie-2"
                  >
                    <Icono className="size-4 text-suave" />
                    <span className="flex-1">
                      {formatearLote(l.cantidad, unidad, producto.cantidad_envase)}
                      {l.abierto_en && (
                        <span className="text-suave">
                          {" "}
                          · empezado
                          {describirQueda(l.cantidad, producto.cantidad_envase) ? `, ${describirQueda(l.cantidad, producto.cantidad_envase)}` : ""}
                        </span>
                      )}
                    </span>
                    <Etiqueta tono={tono(estadoCaducidad(l.fecha_caducidad, hoy))}>{describirCaducidad(l.fecha_caducidad, hoy)}</Etiqueta>
                  </button>
                </li>
              );
            })}
            <li>
              <Link
                to={`/productos/${producto.id}`}
                className="flex min-h-12 items-center gap-1 pr-4 pl-[4.25rem] text-[15px] font-medium text-primario"
              >
                Ver ficha <ChevronRight className="size-4" />
              </Link>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
