import type { FechaISO } from "./caducidad.js";
import { abrirEnvase, type Apertura, type LoteAbrible } from "./alergenos.js";
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

/** Lo que puede quedar de un envase empezado. */
export const FRACCIONES_QUEDA = [
  { valor: 0.25, etiqueta: "¼" },
  { valor: 0.5, etiqueta: "½" },
  { valor: 0.75, etiqueta: "¾" },
] as const;

/** Qué cambiar al marcar "queda ½" en un lote. */
export interface PlanQueda extends Apertura {
  /** Lo que se ha gastado (en unidad base): se registra como consumo. */
  consumido: number;
}

/**
 * "Está empezado y queda ½": si el lote estaba cerrado, se abre un envase (separándolo si había varios,
 * y acortando la caducidad como al abrirlo) y se deja en esa fracción; si ya estaba empezado, se ajusta lo que queda.
 * Sin tamaño de envase (a granel), la fracción es de lo que hay ahora.
 */
export function planQueda(
  lote: LoteAbrible & { abierto_en: FechaISO | null },
  cantidadEnvase: number | null,
  fraccion: number,
  diasTrasAbrir: number | null,
  hoy: FechaISO,
): PlanQueda {
  const redondo = (n: number) => Math.round(n * 1000) / 1000;
  if (lote.abierto_en) {
    // Ya empezado: es un solo envase (o lo que quede a granel).
    const total = cantidadEnvase && cantidadEnvase >= lote.cantidad ? cantidadEnvase : lote.cantidad;
    const queda = redondo(total * fraccion);
    return {
      abierto: { id: lote.id, cantidad: queda, fecha_caducidad: lote.fecha_caducidad, abierto_en: lote.abierto_en },
      restoCerrado: null,
      consumido: redondo(lote.cantidad - queda),
    };
  }
  const apertura = abrirEnvase(lote, cantidadEnvase, diasTrasAbrir, hoy);
  const queda = redondo(apertura.abierto.cantidad * fraccion);
  return {
    abierto: { ...apertura.abierto, cantidad: queda },
    restoCerrado: apertura.restoCerrado,
    consumido: redondo(apertura.abierto.cantidad - queda),
  };
}

/** "Queda ½" para mostrar en la lista: la fracción más cercana de lo que queda de un envase empezado. */
export function describirQueda(cantidad: number, cantidadEnvase: number | null): string | null {
  if (!cantidadEnvase || cantidad >= cantidadEnvase || cantidad <= 0) return null;
  const f = cantidad / cantidadEnvase;
  const cercana = FRACCIONES_QUEDA.reduce((a, b) => (Math.abs(b.valor - f) < Math.abs(a.valor - f) ? b : a));
  return Math.abs(cercana.valor - f) <= 0.05 ? `queda ${cercana.etiqueta}` : `queda ${Math.round(f * 100)} %`;
}

export type OrdenDespensa = "caducidad" | "nombre" | "tipo";

/**
 * Cómo se presenta la despensa: por caducidad (lo primero que hay que gastar), por nombre o
 * por tipo de alimento (sección del súper, en el orden de recorrido de la tienda y después alfabético).
 * `grupos` llega ya ordenado por caducidad (agruparPorProducto); dentro de cada tipo se mantiene ese orden.
 */
export function organizarDespensa<G extends { lotes: { producto: { nombre: string } }[] }>(
  grupos: G[],
  orden: OrdenDespensa,
  seccionDe: (g: G) => string,
  ordenSecciones: string[] = [],
): { seccion: string | null; grupos: G[] }[] {
  if (orden === "caducidad") return [{ seccion: null, grupos }];
  if (orden === "nombre") {
    return [{ seccion: null, grupos: [...grupos].sort((a, b) => a.lotes[0].producto.nombre.localeCompare(b.lotes[0].producto.nombre, "es")) }];
  }
  const porSeccion = new Map<string, G[]>();
  for (const g of grupos) porSeccion.set(seccionDe(g), [...(porSeccion.get(seccionDe(g)) ?? []), g]);
  const posicion = (s: string) => (ordenSecciones.includes(s) ? ordenSecciones.indexOf(s) : ordenSecciones.length);
  return [...porSeccion.entries()]
    .sort(([a], [b]) => posicion(a) - posicion(b) || a.localeCompare(b, "es"))
    .map(([seccion, lista]) => ({ seccion, grupos: lista }));
}
