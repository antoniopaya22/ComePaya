import type { FechaISO } from "./caducidad.js";

// Deshacer un cambio de despensa: se guarda cómo estaban los lotes de los productos afectados antes y justo
// después del cambio y, al deshacer, se calcula qué crear, corregir y borrar sin pisar lo que otro móvil haya hecho.

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

type CampoLote = "ubicacion" | "fecha_caducidad" | "abierto_en";
const CAMPOS: CampoLote[] = ["ubicacion", "fecha_caducidad", "abierto_en"];

export interface PlanDeshacer {
  lotes_crear: Omit<FotoLote, "id">[];
  lotes_actualizar: ({ id: string } & Partial<Pick<FotoLote, CampoLote>>)[];
  lotes_delta: { id: string; delta: number }[];
  lotes_borrar: string[];
}

/**
 * Qué hacer para deshacer un cambio sin pisar lo que otro móvil haya hecho después. Compara cómo estaban los lotes
 * `antes` del cambio, cómo quedaron justo `despues` y cómo están `ahora`:
 * - los que el cambio quitó se crean de nuevo (con otro id);
 * - los que creó se borran, si siguen;
 * - en los que cambió, la cantidad se corrige con la diferencia (lo que el otro haya gastado después se respeta) y
 *   sitio, caducidad y apertura vuelven a lo de antes solo si nadie los ha tocado desde entonces;
 * - los que haya creado o quitado otro desde entonces no se tocan.
 */
export function planDeshacer(antes: FotoLote[], despues: FotoLote[], ahora: FotoLote[]): PlanDeshacer {
  const porId = (lotes: FotoLote[]) => new Map(lotes.map((l) => [l.id, l]));
  const [previos, tras, actuales] = [porId(antes), porId(despues), porId(ahora)];
  const plan: PlanDeshacer = { lotes_crear: [], lotes_actualizar: [], lotes_delta: [], lotes_borrar: [] };
  for (const [id, previo] of previos) {
    const quedo = tras.get(id);
    const actual = actuales.get(id);
    if (!quedo) {
      if (!actual) {
        plan.lotes_crear.push({
          producto_id: previo.producto_id,
          cantidad: previo.cantidad,
          ubicacion: previo.ubicacion,
          fecha_caducidad: previo.fecha_caducidad,
          abierto_en: previo.abierto_en,
        });
      }
      continue;
    }
    if (!actual) continue;
    const delta = Math.round((previo.cantidad - quedo.cantidad) * 1000) / 1000;
    if (delta) plan.lotes_delta.push({ id, delta });
    const campos: Partial<Pick<FotoLote, CampoLote>> = {};
    for (const c of CAMPOS) if (previo[c] !== quedo[c] && actual[c] === quedo[c]) Object.assign(campos, { [c]: previo[c] });
    if (Object.keys(campos).length) plan.lotes_actualizar.push({ id, ...campos });
  }
  for (const id of tras.keys()) if (!previos.has(id) && actuales.has(id)) plan.lotes_borrar.push(id);
  return plan;
}

export function planVacio(plan: PlanDeshacer): boolean {
  return !plan.lotes_crear.length && !plan.lotes_actualizar.length && !plan.lotes_delta.length && !plan.lotes_borrar.length;
}
