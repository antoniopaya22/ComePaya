import { CircleCheck, Scale, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { Tarjeta } from "@/components/ui/varios";
import { contarGrupos, evaluarEquilibrio, GRUPOS_ALIMENTO, gruposDeReceta, type GrupoAlimento } from "@/dominio/nutricion";
import type { FranjaMenu } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { useIngredientes, useRecetas, useReglas } from "../datos";

/** Equilibrio del plan semanal frente a las reglas del hogar (§8.3). */
export function EquilibrioSemana({ franjas }: { franjas: FranjaMenu[] }) {
  const { data: recetas = [] } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: reglas = [] } = useReglas();

  const { cuenta, avisos, sinGrupo } = useMemo(() => {
    const grupoDe = new Map(ingredientes.map((i) => [i.id, i.grupo_alimento]));
    const grupos = new Map<string, Set<GrupoAlimento>>(
      recetas.map((r) => [r.id, gruposDeReceta(r.ingredientes.map((ri) => ({ opcional: ri.opcional, grupo: grupoDe.get(ri.ingrediente_id) ?? null })))]),
    );
    const cuenta = contarGrupos(franjas, grupos);
    const usadas = new Set(franjas.filter((f) => f.receta_id && !f.fuera_de_casa).map((f) => f.receta_id!));
    return {
      cuenta,
      avisos: evaluarEquilibrio(cuenta, reglas),
      sinGrupo: recetas.filter((r) => usadas.has(r.id) && !grupos.get(r.id)?.size).map((r) => r.nombre),
    };
  }, [franjas, recetas, ingredientes, reglas]);

  const planificadas = franjas.some((f) => f.receta_id && !f.fuera_de_casa);
  if (!planificadas) return null;

  return (
    <Tarjeta className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Scale className="size-4 text-primario" />
        <h2 className="font-semibold">Equilibrio de la semana</h2>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {reglas.map((r) => {
          const n = cuenta.get(r.grupo_alimento) ?? 0;
          const mal = (r.minimo_semana !== null && n < r.minimo_semana) || (r.maximo_semana !== null && n > r.maximo_semana);
          const etiqueta = GRUPOS_ALIMENTO.find((g) => g.valor === r.grupo_alimento)?.etiqueta ?? r.grupo_alimento;
          // "Legumbre: 1 de 3" (mínimo) o "Huevo: 1, máx. 4".
          const texto = r.minimo_semana !== null ? `${etiqueta}: ${n} de ${r.minimo_semana}` : `${etiqueta}: ${n}, máx. ${r.maximo_semana}`;
          return (
            <span
              key={r.grupo_alimento}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium",
                mal ? "bg-aviso-suave text-aviso" : "bg-primario-suave text-primario",
              )}
            >
              {mal ? <TriangleAlert className="size-3.5" aria-label="Fuera de lo que os habéis marcado" /> : <CircleCheck className="size-3.5" aria-hidden />}
              {texto}
            </span>
          );
        })}
      </div>
      {/* Cada etiqueta ya dice lo que falta o sobra; aquí solo el resumen cuando todo cuadra. */}
      {!avisos.length && (
        <p className="flex items-center gap-2 text-sm text-primario">
          <CircleCheck className="size-4" /> La semana cumple vuestras reglas.
        </p>
      )}
      {sinGrupo.length > 0 && (
        <p className="text-xs text-suave">
          Sin grupo de alimentos en sus ingredientes: {sinGrupo.join(", ")}. Asígnalo en Ajustes → Ingredientes para que cuenten.
        </p>
      )}
    </Tarjeta>
  );
}
