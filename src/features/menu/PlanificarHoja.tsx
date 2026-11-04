import { useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Hoja } from "@/components/ui/hoja";
import { paraDe } from "@/dominio/bebe";
import { diasDeSemana, DIAS_SEMANA } from "@/dominio/menu";
import { planificarSemana, type Hueco } from "@/dominio/planificar";
import { hoyISO, type FechaISO } from "@/dominio/caducidad";
import { supabase } from "@/lib/supabase";
import type { FranjaMenu } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { useContextoSemana } from "./useSugerencias";

/**
 * Planificación automática (§9.3): propone recetas para los huecos libres de la semana (desde hoy).
 * No toca lo ya planificado; se pueden descartar propuestas antes de aplicarlas.
 */
export function PlanificarHoja({ abierta, lunes, franjas, onCerrar }: { abierta: boolean; lunes: FechaISO; franjas: FranjaMenu[]; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { aptas, base } = useContextoSemana(lunes, franjas);
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const hoy = hoyISO();

  useEffect(() => {
    if (abierta) setDescartadas(new Set());
  }, [abierta]);

  const huecos: Hueco[] = useMemo(
    () =>
      diasDeSemana(lunes)
        .filter((fecha) => fecha >= hoy)
        .flatMap((fecha) =>
          (["comida", "cena"] as const)
            .filter((tipo) => {
              const f = franjas.find((x) => x.fecha === fecha && x.tipo === tipo && paraDe(x) === "casa");
              return !f || (!f.receta_id && !f.fuera_de_casa);
            })
            .map((tipo) => ({ fecha, tipo, raciones: hogar.comensales ?? 2 })),
        ),
    [lunes, franjas, hoy, hogar.comensales],
  );

  const propuestas = useMemo(() => (abierta ? planificarSemana(huecos, aptas, base) : []), [abierta, huecos, aptas, base]);
  const clave = (p: Hueco) => `${p.fecha}-${p.tipo}`;
  const elegidas = propuestas.filter((p) => !descartadas.has(clave(p)));

  async function aplicar() {
    setGuardando(true);
    const { error } = await supabase.from("franja_menu").upsert(
      elegidas.map((p) => ({ hogar_id: hogar.id, fecha: p.fecha, tipo: p.tipo, para: "casa", receta_id: p.receta_id, raciones: p.raciones, fuera_de_casa: false, es_sobra_de: null, cocinado: false })),
      { onConflict: "hogar_id,fecha,tipo,para" },
    );
    setGuardando(false);
    if (error) return toast.error(mensajeError(error));
    void queryClient.invalidateQueries({ queryKey: claves.franjas(hogar.id) });
    toast.success(`${elegidas.length} comidas planificadas`, { description: "Ahora puedes completar la lista desde el menú." });
    onCerrar();
  }

  const nombreDia = (fecha: FechaISO) => DIAS_SEMANA[(new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7];

  return (
    <Hoja
      abierta={abierta}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo="Rellenar la semana"
      descripcion="Propuesta según lo que tenéis en casa, lo que caduca, el equilibrio de la semana y vuestras valoraciones."
      pie={
        propuestas.length > 0 && (
          <Boton className="w-full" tamano="lg" onClick={aplicar} disabled={guardando || !elegidas.length}>
            <Check /> Planificar {elegidas.length} {elegidas.length === 1 ? "comida" : "comidas"}
          </Boton>
        )
      }
    >
      {!huecos.length ? (
        <p className="py-6 text-center text-sm text-suave">
          No quedan huecos libres esta semana.
          <br />
          Pasa a la semana siguiente con › y vuelve a pulsar ✨.
        </p>
      ) : !aptas.length ? (
        <p className="py-6 text-center text-sm text-suave">Aún no hay recetas para proponer. Crea o importa algunas en Recetas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {propuestas.map((p) => {
            const fuera = descartadas.has(clave(p));
            return (
              <li key={clave(p)} className={cn("flex items-start gap-3 rounded-xl border border-borde p-3 transition-opacity", fuera && "opacity-45")}>
                <span className="w-20 shrink-0 text-xs font-semibold tracking-wide text-suave uppercase">
                  {nombreDia(p.fecha).slice(0, 3)} · {p.tipo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-medium", fuera && "line-through")}>{p.nombre}</span>
                  <span className="block text-xs text-suave">{p.motivos.slice(0, 2).join(" · ")}</span>
                </span>
                <button
                  aria-label={fuera ? `Recuperar ${p.nombre}` : `Descartar ${p.nombre}`}
                  onClick={() => {
                    const nuevas = new Set(descartadas);
                    if (fuera) nuevas.delete(clave(p));
                    else nuevas.add(clave(p));
                    setDescartadas(nuevas);
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-suave hover:bg-superficie-2"
                >
                  {fuera ? <RotateCcw className="size-4" /> : <X className="size-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Hoja>
  );
}
