import { BarChart3, BookOpen, CalendarDays, Check, ChevronsUpDown, House, ListChecks, Package, Plus, Refrigerator, ScanBarcode, Search, Settings, type LucideIcon } from "lucide-react";
import { m as motion } from "motion/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router";
import { useEnLinea } from "@/features/lista/sin-conexion";
import { Avisos, iniciales, MenuUsuario, useUrgentes } from "@/components/Cuenta";
import { FalloPantalla } from "@/components/FalloPantalla";
import { Logo } from "@/components/Logo";
import { TirarParaRecargar } from "@/components/TirarParaRecargar";
import { Menu, MenuContenido, MenuDisparador, MenuEtiqueta, MenuOpcion, MenuSeparador } from "@/components/ui/menu";
import { Cargando } from "@/components/ui/varios";
import { ATAJO_BUSCAR, Buscador, ProveedorBuscador, useAtajoBuscar } from "@/features/buscador/Buscador";
import { useLista } from "@/features/datos";
import { useHogar } from "@/features/hogar/HogarProvider";
import { Recorrido } from "@/features/recorrido/Recorrido";
import { VERSION } from "@/lib/errores";
import { modoDemo } from "@/lib/supabase";
import { useSincronizacionHogar } from "@/lib/tiempo-real";
import { cn } from "@/lib/utils";

interface Seccion {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
}

const SECCIONES: Seccion[] = [
  { ruta: "/", etiqueta: "Hoy", icono: House },
  { ruta: "/menu", etiqueta: "Menú", icono: CalendarDays },
  { ruta: "/lista", etiqueta: "Lista", icono: ListChecks },
  { ruta: "/despensa", etiqueta: "Despensa", icono: Refrigerator },
  { ruta: "/recetas", etiqueta: "Recetas", icono: BookOpen },
];

const HERRAMIENTAS: Seccion[] = [
  { ruta: "/productos", etiqueta: "Productos", icono: Package },
  { ruta: "/escanear", etiqueta: "Escanear", icono: ScanBarcode },
  { ruta: "/ajustes/estadisticas", etiqueta: "Estadísticas", icono: BarChart3 },
];

/** Número sobre el icono de la app instalada. */
function useContadorEnIcono(n: number) {
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }, [n]);
}

/** Pantallas con navegación inferior en el móvil; las demás se abren encima, con su flecha de volver. */
const RAICES = SECCIONES.map((s) => s.ruta);

/**
 * Al ir a una pantalla nueva se empieza arriba; al volver atrás, donde se estaba (como en una app).
 */
function useDesplazamientoComoApp() {
  const location = useLocation();
  const tipo = useNavigationType();
  const posiciones = useRef(new Map<string, number>());
  useEffect(() => {
    const clave = location.key;
    if (tipo === "POP") {
      const y = posiciones.current.get(clave) ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      window.scrollTo(0, 0);
    }
    return () => {
      posiciones.current.set(clave, window.scrollY);
    };
  }, [location.key, tipo]);
}

/** Móvil: cada pantalla con su barra de app y navegación inferior en las principales. Escritorio (md+): barra lateral y barra superior con buscador. */
export function Estructura() {
  // Al cambiar de pantalla se reinicia el aviso de fallo.
  const location = useLocation();
  const enLinea = useEnLinea();
  const tipo = useNavigationType();
  const { hogar } = useHogar();
  useSincronizacionHogar(hogar.id);
  useDesplazamientoComoApp();
  const urgentes = useUrgentes();
  const { data: lista } = useLista();
  const pendientes = (lista ?? []).filter((i) => !i.marcado).length;
  const [buscando, setBuscando] = useState(false);
  const abrirBuscador = useCallback(() => setBuscando(true), []);
  useAtajoBuscar(abrirBuscador);
  useContadorEnIcono(urgentes.length);

  const contadores: Record<string, { n: number; aviso?: boolean }> = {
    "/lista": { n: pendientes },
    "/despensa": { n: urgentes.length, aviso: true },
  };
  const raiz = RAICES.includes(location.pathname);
  // Entre pestañas, un fundido; al abrir una pantalla, entra desde la derecha; al volver, solo fundido.
  const entrada = raiz || tipo === "POP" ? { opacity: 0 } : { opacity: 0, x: 28 };

  return (
    <ProveedorBuscador value={abrirBuscador}>
      <div className="min-h-dvh md:flex">
        <BarraLateral contadores={contadores} />

        <div className="min-w-0 flex-1">
          <BarraSuperior onBuscar={abrirBuscador} />
          <main
            className={cn(
              "mx-auto w-full max-w-2xl md:px-8 md:pb-12",
              raiz ? "pb-[calc(env(safe-area-inset-bottom)+6.5rem)]" : "pb-[calc(env(safe-area-inset-bottom)+2rem)]",
            )}
          >
            {!enLinea && location.pathname !== "/lista" && (
              <p role="status" className="mx-4 mb-3 rounded-2xl bg-superficie-2 px-3.5 py-2.5 text-sm text-suave md:mx-0">
                <span className="font-semibold text-texto">Sin conexión.</span> Ves lo guardado en este móvil; lo que cambies fuera de la
                lista se podrá guardar al volver la red.
              </p>
            )}
            <FalloPantalla key={location.pathname}>
              <motion.div initial={entrada} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
                <Suspense fallback={<Cargando className="min-h-[60dvh]" />}>
                  <Outlet />
                </Suspense>
              </motion.div>
            </FalloPantalla>
            {modoDemo && (
              <p className="mx-4 mt-8 rounded-full bg-aviso-suave px-3 py-1 text-center text-xs font-medium text-aviso md:mx-0">
                Modo demo: datos de ejemplo, se reinician al reiniciar el servidor
              </p>
            )}
          </main>
        </div>

        {raiz && <NavegacionInferior contadores={contadores} />}
        <Buscador abierto={buscando} onCambiar={setBuscando} />
        <Recorrido />
        <TirarParaRecargar />
      </div>
    </ProveedorBuscador>
  );
}

function BarraLateral({ contadores }: { contadores: Record<string, { n: number; aviso?: boolean }> }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borde bg-superficie md:flex">
      <Link to="/" className="flex h-16 items-center px-5">
        <Logo tamano="sm" />
      </Link>

      <div className="px-3">
        <SelectorHogar />
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Principal" data-recorrido="navegacion">
        <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-suave uppercase">Cocina</p>
        {SECCIONES.map((s) => (
          <EnlaceLateral key={s.ruta} seccion={s} contador={contadores[s.ruta]} />
        ))}
        <p className="mt-5 px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-suave uppercase">Herramientas</p>
        {HERRAMIENTAS.map((s) => (
          <EnlaceLateral key={s.ruta} seccion={s} />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-borde p-3">
        <EnlaceLateral seccion={{ ruta: "/ajustes", etiqueta: "Ajustes", icono: Settings }} exacto />
        <p className="px-3 pt-2 text-[11px] text-suave/70">ComePayá · {VERSION === "local" ? "desarrollo" : `versión ${VERSION}`}</p>
      </div>
    </aside>
  );
}

function EnlaceLateral({ seccion, contador, exacto }: { seccion: Seccion; contador?: { n: number; aviso?: boolean }; exacto?: boolean }) {
  const { ruta, etiqueta, icono: Icono } = seccion;
  return (
    <NavLink
      to={ruta}
      end={exacto || ruta === "/" || ruta === "/ajustes"}
      className={({ isActive }) =>
        cn(
          "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition-colors",
          isActive ? "bg-primario-suave text-primario" : "text-suave hover:bg-superficie-2 hover:text-texto",
        )
      }
    >
      <Icono className="size-[18px]" />
      <span className="flex-1">{etiqueta}</span>
      {!!contador?.n && (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums",
            contador.aviso ? "bg-aviso-suave text-aviso" : "bg-superficie-2 text-suave group-aria-[current=page]:bg-superficie",
          )}
        >
          {contador.n}
        </span>
      )}
    </NavLink>
  );
}

/** Hogar activo y cambio entre hogares (por ejemplo, el tuyo y el de tus padres). */
function SelectorHogar() {
  const { hogar, hogares, cambiarHogar, anadirHogar } = useHogar();
  return (
    <Menu>
      <MenuDisparador data-recorrido="hogar" className="flex w-full items-center gap-3 rounded-2xl border border-borde bg-fondo px-3 py-2 text-left transition-colors hover:bg-superficie-2 data-[state=open]:bg-superficie-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primario-suave text-sm font-semibold text-primario">
          {iniciales(hogar.nombre)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-suave">Hogar</span>
          <span className="block truncate text-sm leading-tight font-semibold">{hogar.nombre}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-suave" />
      </MenuDisparador>
      <MenuContenido align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <MenuEtiqueta>Tus hogares</MenuEtiqueta>
        {hogares.map(({ hogar: h }) => (
          <MenuOpcion key={h.id} onSelect={() => cambiarHogar(h.id)}>
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-superficie-2 text-[11px] font-semibold">{iniciales(h.nombre)}</span>
            <span className="flex-1 truncate">{h.nombre}</span>
            {h.id === hogar.id && <Check className="text-primario!" />}
          </MenuOpcion>
        ))}
        <MenuSeparador />
        <MenuOpcion onSelect={anadirHogar}>
          <Plus /> Crear o unirse a otro
        </MenuOpcion>
      </MenuContenido>
    </Menu>
  );
}

/** Barra superior de escritorio; en el móvil cada pantalla tiene su barra de app (BarraApp). */
function BarraSuperior({ onBuscar }: { onBuscar: () => void }) {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-borde/70 bg-fondo/85 backdrop-blur-lg md:block">
      <div className="mx-auto flex h-16 items-center gap-2 px-8">
        <button
          onClick={onBuscar}
          data-recorrido="buscar"
          className="flex h-10 w-full max-w-md items-center gap-3 rounded-xl border border-borde bg-superficie px-3 text-sm text-suave shadow-xs transition-colors hover:border-primario/40"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar recetas, productos, ingredientes…</span>
          <kbd className="rounded-md border border-borde bg-fondo px-1.5 py-0.5 font-sans text-[11px]">{ATAJO_BUSCAR}</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/escanear"
            data-recorrido="escanear"
            className="hidden h-10 items-center gap-2 rounded-xl bg-primario px-3.5 text-sm font-semibold text-primario-texto shadow-sm transition-colors hover:bg-primario-hover lg:flex"
          >
            <ScanBarcode className="size-4" /> Escanear
          </Link>
          <Link to="/escanear" aria-label="Escanear" data-recorrido="escanear" className="grid size-10 place-items-center rounded-xl text-suave transition-colors hover:bg-superficie-2 hover:text-texto lg:hidden [&_svg]:size-5">
            <ScanBarcode />
          </Link>
          <Avisos />
          <MenuUsuario />
        </div>
      </div>
    </header>
  );
}

function NavegacionInferior({ contadores }: { contadores: Record<string, { n: number; aviso?: boolean }> }) {
  return (
    <nav className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie/90 backdrop-blur-lg md:hidden" aria-label="Principal" data-recorrido="navegacion">
      <div className="mx-auto flex max-w-md">
        {SECCIONES.map(({ ruta, etiqueta, icono: Icono }) => {
          const contador = contadores[ruta];
          return (
            <NavLink key={ruta} to={ruta} end={ruta === "/"} className="relative flex h-16 flex-1 flex-col items-center justify-center gap-1">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-activo"
                      className="absolute top-2 h-8 w-14 rounded-full bg-primario-suave"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative">
                    <Icono className={cn("size-[22px]", isActive ? "text-primario" : "text-suave")} />
                    {!!contador?.n && (
                      <span
                        className={cn(
                          "absolute -top-1.5 -right-2.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-bold text-white ring-2 ring-superficie",
                          contador.aviso ? "bg-aviso" : "bg-primario",
                        )}
                      >
                        {contador.n > 9 ? "9+" : contador.n}
                      </span>
                    )}
                  </span>
                  <span className={cn("relative text-[11px] font-medium", isActive ? "text-texto" : "text-suave")}>{etiqueta}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

