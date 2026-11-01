import type { FechaISO } from "./caducidad";

export interface LoteDescontable {
  id: string;
  cantidad: number;
  fecha_caducidad: FechaISO | null;
  creado_en: string;
}

export interface PlanDescuento {
  /** Lotes que cambian: `restante` 0 significa que se gasta entero y se borra. */
  lotes: { id: string; consumido: number; restante: number }[];
  /** Lo que la receta pedía y no había en la despensa. */
  sinCubrir: number;
}

/**
 * Reparte una cantidad consumida entre los lotes de un ingrediente (§3.5): primero lo que caduca antes,
 * después lo que no tiene fecha, y a igualdad lo más antiguo.
 */
export function planDescuento(lotes: LoteDescontable[], cantidad: number): PlanDescuento {
  const ordenados = [...lotes].sort(
    (a, b) =>
      (a.fecha_caducidad ?? "9999-12-31").localeCompare(b.fecha_caducidad ?? "9999-12-31") || a.creado_en.localeCompare(b.creado_en),
  );
  const plan: PlanDescuento = { lotes: [], sinCubrir: 0 };
  let pendiente = cantidad;
  for (const lote of ordenados) {
    if (pendiente <= 0) break;
    const consumido = Math.min(lote.cantidad, pendiente);
    plan.lotes.push({ id: lote.id, consumido, restante: redondear(lote.cantidad - consumido) });
    pendiente = redondear(pendiente - consumido);
  }
  plan.sinCubrir = Math.max(0, pendiente);
  return plan;
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}
