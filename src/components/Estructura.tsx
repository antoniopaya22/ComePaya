import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronsUpDown,
  House,
  ListChecks,
  LogOut,
  Bug,
  Package,
  Plus,
  Refrigerator,
  RefreshCw,
  ScanBarcode,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Suspense, useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { FalloPantalla } from "@/components/FalloPantalla";
import { Logo } from "@/components/Logo";
import { TirarParaRecargar } from "@/components/TirarParaRecargar";
import { Menu, MenuContenido, MenuDisparador, MenuEtiqueta, MenuOpcion, MenuSeparador } from "@/components/ui/menu";
import { Cargando } from "@/components/ui/varios";
import { describirCaducidad, estadoCaducidad, hoyISO } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { ATAJO_BUSCAR, Buscador, useAtajoBuscar } from "@/features/buscador/Buscador";
import { useLista, useLotes } from "@/features/datos";
import { useHogar } from "@/features/hogar/HogarProvider";
import { iniciarRecorrido, Recorrido } from "@/features/recorrido/Recorrido";
import { cerrarSesion, useUsuario } from "@/features/sesion/SesionProvider";
import { recargar } from "@/lib/actualizacion";
import { urlReportarProblema, VERSION } from "@/lib/errores";
import { modoDemo } from "@/lib/supabase";
import { useSincronizacionHogar } from "@/lib/tiempo-real";
import type { LoteConProducto } from "@/lib/tipos";
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

/** Lo que está caducado o caduca en los próximos días, lo más urgente primero. */
function useUrgentes(): LoteConProducto[] {
  const { data: lotes } = useLotes();
  return useMemo(() => {
    const hoy = hoyISO();
    return (lotes ?? []).filter((l) => ["caducado", "pronto"].includes(estadoCaducidad(l.fecha_caducidad, hoy)));
  }, [lotes]);
}

/** Número sobre el icono de la app instalada. */
function useContadorEnIcono(n: number) {
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }, [n]);
}

/** Móvil: barra superior y navegación inferior. Escritorio (md+): barra lateral y barra superior con buscador. */
export function Estructura() {
  // Al cambiar de pantalla se reinicia el aviso de fallo.
  const location = useLocation();
  const { hogar } = useHogar();
  useSincronizacionHogar(hogar.id);
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

  return (
    <div className="min-h-dvh md:flex">
      <BarraLateral contadores={contadores} />

      <div className="min-w-0 flex-1">
        <BarraSuperior urgentes={urgentes} onBuscar={abrirBuscador} />
        <main className="mx-auto w-full max-w-2xl pb-28 md:px-8 md:pb-12">
          {modoDemo && (
            <p className="mx-4 mt-3 rounded-full bg-aviso-suave px-3 py-1 text-center text-xs font-medium text-aviso md:mx-0">
              Modo demo: datos de ejemplo, se reinician al reiniciar el servidor
            </p>
          )}
          <FalloPantalla key={location.pathname}>
            <Suspense fallback={<Cargando className="min-h-[60dvh]" />}>
              <Outlet />
            </Suspense>
          </FalloPantalla>
        </main>
      </div>

      <NavegacionInferior contadores={contadores} />
      <Buscador abierto={buscando} onCambiar={setBuscando} />
      <Recorrido />
      <TirarParaRecargar />
    </div>
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

function BarraSuperior({ urgentes, onBuscar }: { urgentes: LoteConProducto[]; onBuscar: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-borde/70 bg-fondo/85 backdrop-blur-lg">
      <div className="mx-auto flex h-14 items-center gap-2 px-4 md:h-16 md:px-8">
        <Link to="/" className="md:hidden" aria-label="Inicio">
          <Logo tamano="sm" />
        </Link>

        {/* Escritorio: campo de búsqueda. */}
        <button
          onClick={onBuscar}
          data-recorrido="buscar"
          className="hidden h-10 w-full max-w-md items-center gap-3 rounded-xl border border-borde bg-superficie px-3 text-sm text-suave shadow-xs transition-colors hover:border-primario/40 md:flex"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar recetas, productos, ingredientes…</span>
          <kbd className="rounded-md border border-borde bg-fondo px-1.5 py-0.5 font-sans text-[11px]">{ATAJO_BUSCAR}</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <BotonIcono etiqueta="Buscar" onClick={onBuscar} className="md:hidden" data-recorrido="buscar">
            <Search />
          </BotonIcono>
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
          <Avisos urgentes={urgentes} />
          <MenuUsuario />
        </div>
      </div>
    </header>
  );
}

function BotonIcono({ etiqueta, className, ...props }: ComponentProps<"button"> & { etiqueta: string }) {
  return (
    <button
      aria-label={etiqueta}
      title={etiqueta}
      className={cn("relative grid size-10 place-items-center rounded-xl text-suave transition-colors hover:bg-superficie-2 hover:text-texto [&_svg]:size-5", className)}
      {...props}
    />
  );
}

/** Campana con lo que caduca: un vistazo rápido sin ir a la despensa. */
function Avisos({ urgentes }: { urgentes: LoteConProducto[] }) {
  const navigate = useNavigate();
  const hoy = hoyISO();
  return (
    <Menu>
      <MenuDisparador asChild>
        <BotonIcono etiqueta={urgentes.length ? `${urgentes.length} avisos de caducidad` : "Avisos"} data-recorrido="avisos">
          <Bell />
          {urgentes.length > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-aviso px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-fondo">
              {urgentes.length > 9 ? "9+" : urgentes.length}
            </span>
          )}
        </BotonIcono>
      </MenuDisparador>
      <MenuContenido className="w-80">
        <MenuEtiqueta>Caducidades</MenuEtiqueta>
        {urgentes.length === 0 && <p className="px-3 pt-1 pb-3 text-sm text-suave">Nada caduca en los próximos días. 👌</p>}
        {urgentes.slice(0, 6).map((l) => {
          const p = l.producto;
          const caducado = estadoCaducidad(l.fecha_caducidad, hoy) === "caducado";
          return (
            <MenuOpcion key={l.id} onSelect={() => navigate(`/productos/${p.id}`)} className="py-1.5">
              <span className="text-lg">{emojiPara(p.ingrediente?.nombre ?? p.nombre, p.ingrediente?.seccion_super ?? null, p.ingrediente?.emoji)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.nombre}</span>
                <span className={cn("block text-xs first-letter:uppercase", caducado ? "text-peligro" : "text-aviso")}>
                  {describirCaducidad(l.fecha_caducidad, hoy)}
                </span>
              </span>
            </MenuOpcion>
          );
        })}
        {urgentes.length > 0 && (
          <>
            <MenuSeparador />
            <MenuOpcion onSelect={() => navigate("/despensa")} className="justify-center font-medium text-primario">
              Ver la despensa{urgentes.length > 6 ? ` (${urgentes.length - 6} más)` : ""}
            </MenuOpcion>
          </>
        )}
      </MenuContenido>
    </Menu>
  );
}

function MenuUsuario() {
  const usuario = useUsuario();
  const { hogar } = useHogar();
  const navigate = useNavigate();
  const nombre: string = usuario.user_metadata.full_name ?? usuario.user_metadata.name ?? usuario.email ?? "";
  return (
    <Menu>
      <MenuDisparador data-recorrido="hogar" className="ml-1 rounded-full ring-offset-2 ring-offset-fondo outline-none focus-visible:ring-2 focus-visible:ring-primario" aria-label="Tu cuenta">
        <Avatar url={usuario.user_metadata.avatar_url} nombre={nombre} />
      </MenuDisparador>
      <MenuContenido className="w-64">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar url={usuario.user_metadata.avatar_url} nombre={nombre} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{nombre}</p>
            <p className="truncate text-xs text-suave">{usuario.email}</p>
          </div>
        </div>
        <p className="mx-3 mb-1 truncate rounded-lg bg-superficie-2 px-2 py-1 text-xs text-suave md:hidden">🏠 {hogar.nombre}</p>
        <MenuSeparador />
        <MenuOpcion onSelect={() => navigate("/ajustes")}>
          <Settings /> Ajustes y hogar
        </MenuOpcion>
        <MenuOpcion onSelect={() => navigate("/ajustes/estadisticas")}>
          <BarChart3 /> Estadísticas
        </MenuOpcion>
        <MenuOpcion onSelect={() => toast.promise(recargar(), { loading: "Actualizando…", success: "Todo al día", error: "No se ha podido actualizar" })}>
          <RefreshCw /> Actualizar
        </MenuOpcion>
        <MenuOpcion onSelect={iniciarRecorrido}>
          <Sparkles /> Ver el recorrido
        </MenuOpcion>
        <MenuOpcion onSelect={() => window.open(urlReportarProblema(), "_blank", "noopener")}>
          <Bug /> Reportar un problema
        </MenuOpcion>
        <MenuSeparador />
        <MenuOpcion peligro onSelect={() => cerrarSesion()}>
          <LogOut /> Cerrar sesión
        </MenuOpcion>
      </MenuContenido>
    </Menu>
  );
}

function Avatar({ url, nombre }: { url?: string; nombre: string }) {
  const [fallo, setFallo] = useState(false);
  if (url && !fallo) {
    return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFallo(true)} className="size-9 shrink-0 rounded-full border border-borde object-cover" />;
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primario text-sm font-semibold text-primario-texto">{iniciales(nombre) || "?"}</span>
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

function iniciales(nombre: string): string {
  return nombre
    .replace(/^(casa|hogar) de /i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
