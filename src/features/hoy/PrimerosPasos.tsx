import { Bell, BookOpen, CalendarDays, Check, ChevronRight, ListChecks, ScanBarcode, Sparkles, Users, X, type LucideIcon } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Tarjeta } from "@/components/ui/varios";
import { primerosPasos, progreso, type IdPaso } from "@/dominio/primeros-pasos";
import type { FranjaMenu } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { avisosDisponibles, suscripcionActual } from "../ajustes/avisos";
import { useLista, useLotes, useMiembros, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { iniciarRecorrido } from "../recorrido/Recorrido";

const ACCION: Record<IdPaso, { ruta: string; icono: LucideIcon; boton: string }> = {
  despensa: { ruta: "/escanear", icono: ScanBarcode, boton: "Escanear" },
  receta: { ruta: "/recetas/nueva", icono: BookOpen, boton: "Nueva receta" },
  menu: { ruta: "/menu", icono: CalendarDays, boton: "Ir al menú" },
  lista: { ruta: "/lista", icono: ListChecks, boton: "Ir a la lista" },
  familia: { ruta: "/ajustes", icono: Users, boton: "Ver el código" },
  avisos: { ruta: "/ajustes", icono: Bell, boton: "Activar" },
};

interface Recordado {
  /** Lo hecho alguna vez sigue contando aunque luego se borre (la lista vacía tras comprar, por ejemplo). */
  hechos: IdPaso[];
  oculto: boolean;
}

function leer(hogarId: string): Recordado {
  try {
    return { hechos: [], oculto: false, ...JSON.parse(localStorage.getItem(`comepaya.primeros-pasos.${hogarId}`) ?? "{}") };
  } catch {
    return { hechos: [], oculto: false };
  }
}

function guardar(hogarId: string, recordado: Recordado) {
  try {
    localStorage.setItem(`comepaya.primeros-pasos.${hogarId}`, JSON.stringify(recordado));
  } catch {
    // Sin almacenamiento la tarjeta vuelve a salir; no es grave.
  }
}

/** Tarjeta de Hoy con lo que falta para empezar a usar la app. Desaparece al completarla o al cerrarla. */
export function PrimerosPasos({ franjas, className }: { franjas: FranjaMenu[]; className?: string }) {
  const { hogar } = useHogar();
  const { data: lotes } = useLotes();
  const { data: recetas } = useRecetas();
  const { data: lista } = useLista();
  const { data: miembros } = useMiembros();
  const [avisosActivos, setAvisosActivos] = useState(false);
  const [recordado, setRecordado] = useState(() => leer(hogar.id));

  useEffect(() => setRecordado(leer(hogar.id)), [hogar.id]);
  useEffect(() => {
    suscripcionActual()
      .then((s) => setAvisosActivos(Boolean(s)))
      .catch(() => {});
  }, []);

  const cargado = Boolean(lotes && recetas && lista && miembros);
  const pasos = useMemo(() => {
    const actuales = primerosPasos(
      {
        lotes: lotes?.length ?? 0,
        recetas: recetas?.length ?? 0,
        franjasConReceta: franjas.filter((f) => f.receta_id).length,
        itemsLista: lista?.length ?? 0,
        miembros: miembros?.length ?? 1,
        avisosActivos,
      },
      avisosDisponibles,
    );
    return actuales.map((p) => ({ ...p, hecho: p.hecho || recordado.hechos.includes(p.id) }));
  }, [lotes, recetas, franjas, lista, miembros, avisosActivos, recordado.hechos]);

  // Se recuerda lo hecho para que no vuelva a aparecer como pendiente.
  useEffect(() => {
    if (!cargado) return;
    const hechos = pasos.filter((p) => p.hecho).map((p) => p.id);
    if (hechos.length === recordado.hechos.length) return;
    const nuevo = { ...recordado, hechos };
    guardar(hogar.id, nuevo);
    setRecordado(nuevo);
  }, [cargado, pasos, recordado, hogar.id]);

  function ocultar() {
    const nuevo = { ...recordado, oculto: true };
    guardar(hogar.id, nuevo);
    setRecordado(nuevo);
  }

  const hechos = pasos.filter((p) => p.hecho).length;
  const siguiente = pasos.find((p) => !p.hecho);
  const visible = cargado && !recordado.oculto && Boolean(siguiente);

  return (
    <AnimatePresence initial={false}>
      {visible && siguiente && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("overflow-hidden", className)}
          aria-labelledby="primeros-pasos"
        >
          <Tarjeta className="relative overflow-hidden p-4">
            <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-primario-suave blur-2xl" />
            <div className="relative flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primario text-primario-texto">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="primeros-pasos" className="font-semibold">
                  Primeros pasos
                </h2>
                <p className="text-sm text-suave">
                  {hechos} de {pasos.length} hechos ·{" "}
                  <button onClick={iniciarRecorrido} className="font-medium text-primario">
                    Ver el recorrido
                  </button>
                </p>
              </div>
              <button onClick={ocultar} aria-label="Ocultar primeros pasos" className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-suave hover:bg-superficie-2">
                <X className="size-4" />
              </button>
            </div>

            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={hechos} aria-valuemax={pasos.length}>
              <motion.div className="h-full rounded-full bg-primario" initial={false} animate={{ width: `${progreso(pasos) * 100}%` }} />
            </div>

            <ol className="relative mt-3 flex flex-col">
              {pasos.map((p) => {
                const { ruta, icono: Icono, boton } = ACCION[p.id];
                const actual = p.id === siguiente.id;
                return (
                  <li key={p.id}>
                    <Link
                      to={ruta}
                      className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors", actual ? "bg-primario-suave/60" : "hover:bg-superficie-2")}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border",
                          p.hecho ? "border-primario bg-primario text-primario-texto" : actual ? "border-primario text-primario" : "border-borde text-suave",
                        )}
                      >
                        {p.hecho ? <Check className="size-4" /> : <Icono className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm font-medium", p.hecho && "text-suave line-through")}>{p.titulo}</span>
                        {actual && <span className="block text-xs text-suave">{p.detalle}</span>}
                      </span>
                      {actual && (
                        <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primario">
                          {boton} <ChevronRight className="size-4" />
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Tarjeta>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
