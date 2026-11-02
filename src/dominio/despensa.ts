import type { FechaISO } from "./caducidad.js";
import type { UnidadBase } from "./unidades.js";

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

export interface LoteMovible {
  id: string;
  producto_id: string;
  cantidad: number;
  ubicacion: string;
  fecha_caducidad: FechaISO | null;
  abierto_en: FechaISO | null;
}

/** Qué cambiar para mover parte de un lote a otro sitio. */
export interface PlanMover {
  /** El lote entero cambia de sitio. */
  cambiarUbicacion?: { id: string; ubicacion: string };
  /** Sumas y restas sobre lotes existentes (el de origen y, si lo hay, uno igual en el destino). */
  deltas: { id: string; delta: number }[];
  /** Lote nuevo en el destino con lo movido. */
  crear?: { producto_id: string; cantidad: number; ubicacion: string; fecha_caducidad: FechaISO | null; abierto_en: FechaISO | null };
}

/**
 * Mover `cantidad` (en unidad base) de un lote a `destino`: "de los 6 yogures, 2 a la nevera".
 * Si en el destino ya hay un lote del mismo producto con la misma caducidad y el mismo estado (abierto o no),
 * se suma a ese en vez de crear otro; si se mueve todo y no hay con quién juntarlo, el lote solo cambia de sitio.
 */
export function planMover(lote: LoteMovible, cantidad: number, destino: string, otros: LoteMovible[]): PlanMover | null {
  const mover = Math.min(cantidad, lote.cantidad);
  if (mover <= 0 || destino === lote.ubicacion) return null;
  const igual = otros.find(
    (o) =>
      o.id !== lote.id &&
      o.producto_id === lote.producto_id &&
      o.ubicacion === destino &&
      o.fecha_caducidad === lote.fecha_caducidad &&
      Boolean(o.abierto_en) === Boolean(lote.abierto_en),
  );
  if (igual) return { deltas: [{ id: lote.id, delta: -mover }, { id: igual.id, delta: mover }] };
  if (mover >= lote.cantidad) return { cambiarUbicacion: { id: lote.id, ubicacion: destino }, deltas: [] };
  return {
    deltas: [{ id: lote.id, delta: -mover }],
    crear: { producto_id: lote.producto_id, cantidad: mover, ubicacion: destino, fecha_caducidad: lote.fecha_caducidad, abierto_en: lote.abierto_en },
  };
}

/** Secciones de frescos (sin código de barras): las que muestra el alta rápida. */
export const SECCIONES_FRESCOS = ["Fruta y verdura", "Carnicería", "Pescadería", "Panadería", "Charcutería y quesos"];

/** Atajos de cantidad para el alta rápida de frescos, en la unidad base del ingrediente. */
export function cantidadesRapidas(unidad: UnidadBase): { opciones: number[]; paso: number; inicial: number } {
  if (unidad === "ud") return { opciones: [1, 2, 3, 6, 12], paso: 1, inicial: 1 };
  return { opciones: [250, 500, 1000, 2000], paso: 250, inicial: 500 };
}

/** Dónde se guarda normalmente lo de cada sección: el pan y la fruta y verdura de fuera de la nevera, en la despensa. */
export function ubicacionHabitual(seccion: string, nombre: string): "nevera" | "despensa" {
  if (seccion === "Panadería") return "despensa";
  if (seccion === "Fruta y verdura" && /^(patata|cebolla|ajo|pl[aá]tano|lim[oó]n|naranja|calabaza|aguacate|mel[oó]n)/i.test(nombre.trim())) return "despensa";
  return "nevera";
}
