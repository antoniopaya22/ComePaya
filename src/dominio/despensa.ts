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

export interface GrupoLotes<L> {
  producto_id: string;
  lotes: L[];
  total: number;
  /** La caducidad más próxima entre sus lotes (null si ninguno tiene fecha). */
  proxima: FechaISO | null;
}

/**
 * Agrupa los lotes por producto (§4.1): un producto con su total y sus lotes ordenados por caducidad.
 * Los grupos se ordenan por la caducidad más próxima; los que no caducan, al final por nombre.
 */
export function agruparPorProducto<L extends LoteDescontable & { producto_id: string; producto: { nombre: string } }>(lotes: L[]): GrupoLotes<L>[] {
  const grupos = new Map<string, L[]>();
  for (const l of lotes) grupos.set(l.producto_id, [...(grupos.get(l.producto_id) ?? []), l]);
  const clave = (f: FechaISO | null) => f ?? "9999-12-31";
  return [...grupos.entries()]
    .map(([producto_id, lista]) => {
      const ordenados = [...lista].sort((a, b) => clave(a.fecha_caducidad).localeCompare(clave(b.fecha_caducidad)) || a.creado_en.localeCompare(b.creado_en));
      return {
        producto_id,
        lotes: ordenados,
        total: redondear(lista.reduce((t, l) => t + l.cantidad, 0)),
        proxima: ordenados.find((l) => l.fecha_caducidad)?.fecha_caducidad ?? null,
      };
    })
    .sort((a, b) => clave(a.proxima).localeCompare(clave(b.proxima)) || a.lotes[0].producto.nombre.localeCompare(b.lotes[0].producto.nombre, "es"));
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}
