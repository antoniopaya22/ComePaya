import type { FechaISO } from "./caducidad.js";

// Deshacer un cambio de despensa: se guarda cómo estaban los lotes de los productos afectados y, al deshacer,
// se calcula qué crear, actualizar y borrar para volver a ese estado.

export type UbicacionLote = "nevera" | "congelador" | "despensa";

export interface FotoLote {
  id: string;
  producto_id: string;
  cantidad: number;
  ubicacion: UbicacionLote;
  fecha_caducidad: FechaISO | null;
  abierto_en: FechaISO | null;
}

/** Lo que un cambio de despensa toca, con la forma de CambiosDespensa (solo lo necesario para saber qué productos). */
export interface CambiosAfectados {
  lotes_crear?: { producto_id: string }[];
  lotes_actualizar?: { id: string }[];
  lotes_delta?: { id: string }[];
  lotes_borrar?: string[];
  movimientos?: { producto_id: string }[];
}

/** Productos cuyos lotes cambian: los de los movimientos, los lotes nuevos y los lotes tocados. */
export function productosAfectados(cambios: CambiosAfectados, lotes: Pick<FotoLote, "id" | "producto_id">[]): string[] {
  const productoDe = new Map(lotes.map((l) => [l.id, l.producto_id]));
  const ids = [
    ...(cambios.lotes_actualizar ?? []).map((l) => l.id),
    ...(cambios.lotes_delta ?? []).map((l) => l.id),
    ...(cambios.lotes_borrar ?? []),
  ];
  return [
    ...new Set([
      ...(cambios.movimientos ?? []).map((m) => m.producto_id),
      ...(cambios.lotes_crear ?? []).map((l) => l.producto_id),
      ...ids.map((id) => productoDe.get(id)).filter((p): p is string => Boolean(p)),
    ]),
  ];
}

export interface PlanRestaurar {
  lotes_crear: Omit<FotoLote, "id">[];
  lotes_actualizar: FotoLote[];
  lotes_borrar: string[];
}

const igual = (a: FotoLote, b: FotoLote) =>
  a.cantidad === b.cantidad && a.ubicacion === b.ubicacion && a.fecha_caducidad === b.fecha_caducidad && a.abierto_en === b.abierto_en;

/**
 * Qué hacer para que los lotes `ahora` vuelvan a ser `antes`: los que ya no están se crean de nuevo (con otro id),
 * los que han cambiado se dejan como estaban y los que ha creado el cambio se borran.
 */
export function planRestaurar(antes: FotoLote[], ahora: FotoLote[]): PlanRestaurar {
  const actuales = new Map(ahora.map((l) => [l.id, l]));
  const previos = new Set(antes.map((l) => l.id));
  const plan: PlanRestaurar = { lotes_crear: [], lotes_actualizar: [], lotes_borrar: [] };
  for (const l of antes) {
    const actual = actuales.get(l.id);
    if (!actual) {
      plan.lotes_crear.push({ producto_id: l.producto_id, cantidad: l.cantidad, ubicacion: l.ubicacion, fecha_caducidad: l.fecha_caducidad, abierto_en: l.abierto_en });
    } else if (!igual(l, actual)) {
      plan.lotes_actualizar.push(l);
    }
  }
  for (const l of ahora) if (!previos.has(l.id)) plan.lotes_borrar.push(l.id);
  return plan;
}

export function planVacio(plan: PlanRestaurar): boolean {
  return !plan.lotes_crear.length && !plan.lotes_actualizar.length && !plan.lotes_borrar.length;
}
