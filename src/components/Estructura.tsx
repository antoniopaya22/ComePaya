import { BookOpen, CalendarDays, ListChecks, Refrigerator, Settings } from "lucide-react";
import { motion } from "motion/react";
import { NavLink, Outlet } from "react-router";
import { cn } from "@/lib/utils";
import { useHogar } from "@/features/hogar/HogarProvider";

const SECCIONES = [
  { ruta: "/", etiqueta: "Menú", icono: CalendarDays },
  { ruta: "/lista", etiqueta: "Lista", icono: ListChecks },
  { ruta: "/despensa", etiqueta: "Despensa", icono: Refrigerator },
  { ruta: "/recetas", etiqueta: "Recetas", icono: BookOpen },
  { ruta: "/ajustes", etiqueta: "Ajustes", icono: Settings },
];

/** Móvil: navegación inferior. Escritorio (md+): barra lateral. */
export function Estructura() {
  const { hogar } = useHogar();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-borde bg-superficie px-3 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3 px-3">
          <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
          <div className="min-w-0">
            <p className="font-bold leading-tight">Despensa</p>
            <p className="truncate text-xs text-suave">{hogar.nombre}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {SECCIONES.map(({ ruta, etiqueta, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              end={ruta === "/"}
              className={({ isActive }) =>
                cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  isActive ? "bg-primario-suave text-primario" : "text-suave hover:bg-superficie-2 hover:text-texto",
                )
              }
            >
              <Icono className="size-5" />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-2xl pb-28 md:px-8 md:pb-12">
        <Outlet />
      </main>

      <nav className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie/90 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-md">
          {SECCIONES.map(({ ruta, etiqueta, icono: Icono }) => (
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
                  <Icono className={cn("relative size-[22px]", isActive ? "text-primario" : "text-suave")} />
                  <span className={cn("relative text-[11px] font-medium", isActive ? "text-texto" : "text-suave")}>{etiqueta}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
