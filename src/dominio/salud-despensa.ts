// Nutrición de lo que hay en casa (§8.1): ordenar, filtrar y resumir la despensa con los datos que ya trae cada producto.
import type { NivelNutriente, Nutrientes100, ProductoExterno } from "./producto-externo.js";

/** Lo que hace falta de un producto para valorarlo. Lo fresco sin código usa los nutrientes de su ingrediente. */
export interface DatosSalud {
  nutriscore: ProductoExterno["nutriscore"];
  nova: ProductoExterno["nova"];
  nutrientes: Nutrientes100 | null;
  niveles: ProductoExterno["niveles_nutrientes"];
}

export const ORDENES_SALUD = ["nutriscore", "nova", "kcal", "proteina", "azucares", "sal"] as const;
export type OrdenSalud = (typeof ORDENES_SALUD)[number];

export const FILTROS_SALUD = ["ultraprocesado", "azucar", "sal", "sin_datos"] as const;
export type FiltroSalud = (typeof FILTROS_SALUD)[number];

export const ETIQUETA_FILTRO_SALUD: Record<FiltroSalud, string> = {
  ultraprocesado: "Ultraprocesados",
  azucar: "Alto en azúcar",
  sal: "Alto en sal",
  sin_datos: "Sin datos nutricionales",
};

// Umbrales de "alto" por 100 g del semáforo nutricional (FSA, el que usa Open Food Facts), para cuando no trae niveles.
const ALTO_AZUCAR = 22.5;
const ALTO_SAL = 1.5;

export function tieneDatos(d: DatosSalud): boolean {
  return Boolean(d.nutriscore || d.nova || (d.nutrientes && Object.values(d.nutrientes).some((v) => v !== undefined && v !== null)));
}

function nivel(d: DatosSalud, clave: "azucares" | "sal", umbral: number): NivelNutriente | null {
  if (d.niveles?.[clave]) return d.niveles[clave]!;
  const v = d.nutrientes?.[clave];
  return v === undefined || v === null ? null : v > umbral ? "alto" : null;
}

export function cumpleFiltroSalud(d: DatosSalud, filtro: FiltroSalud): boolean {
  switch (filtro) {
    case "ultraprocesado":
      return d.nova === 4;
    case "azucar":
      return nivel(d, "azucares", ALTO_AZUCAR) === "alto";
    case "sal":
      return nivel(d, "sal", ALTO_SAL) === "alto";
    case "sin_datos":
      return !tieneDatos(d);
  }
}

/**
 * Valor por el que se ordena: menor va antes. Nutri-Score y NOVA, de mejor a peor; los nutrientes, de más a menos
 * (para ver de un vistazo lo que más proteína, azúcar, sal o calorías tiene). Sin dato: null, va al final.
 */
export function claveOrdenSalud(d: DatosSalud, orden: OrdenSalud): number | null {
  if (orden === "nutriscore") return d.nutriscore ? "abcde".indexOf(d.nutriscore) : null;
  if (orden === "nova") return d.nova ?? null;
  const v = d.nutrientes?.[orden];
  return v === undefined || v === null ? null : -v;
}

/** Ordena de forma estable: a igualdad (o sin dato) se mantiene el orden que traían (por caducidad). */
export function ordenarPorSalud<G>(grupos: G[], orden: OrdenSalud, saludDe: (g: G) => DatosSalud): G[] {
  return grupos
    .map((g, i) => ({ g, i, k: claveOrdenSalud(saludDe(g), orden) }))
    .sort((a, b) => (a.k === null ? (b.k === null ? a.i - b.i : 1) : b.k === null ? -1 : a.k - b.k || a.i - b.i))
    .map((x) => x.g);
}

/** Texto corto del dato por el que se ordena, para enseñarlo en la fila ("12 g azúcar"). */
export function describirDatoSalud(d: DatosSalud, orden: OrdenSalud): string | null {
  if (orden === "nutriscore" || orden === "nova") return null;
  const v = d.nutrientes?.[orden];
  if (v === undefined || v === null) return "sin dato";
  const n = Math.round(v * 10) / 10;
  const numero = n.toLocaleString("es-ES");
  return orden === "kcal" ? `${Math.round(v)} kcal/100 g` : `${numero} g ${orden === "proteina" ? "proteína" : orden === "azucares" ? "azúcar" : "sal"}/100 g`;
}

export interface ResumenSalud {
  /** Productos con cada letra de Nutri-Score. */
  nutriscore: Record<"a" | "b" | "c" | "d" | "e", number>;
  ultraprocesados: number;
  altoAzucar: number;
  altoSal: number;
  sinDatos: number;
  total: number;
}

export function resumirSalud(datos: DatosSalud[]): ResumenSalud {
  const r: ResumenSalud = { nutriscore: { a: 0, b: 0, c: 0, d: 0, e: 0 }, ultraprocesados: 0, altoAzucar: 0, altoSal: 0, sinDatos: 0, total: datos.length };
  for (const d of datos) {
    if (d.nutriscore) r.nutriscore[d.nutriscore]++;
    if (cumpleFiltroSalud(d, "ultraprocesado")) r.ultraprocesados++;
    if (cumpleFiltroSalud(d, "azucar")) r.altoAzucar++;
    if (cumpleFiltroSalud(d, "sal")) r.altoSal++;
    if (cumpleFiltroSalud(d, "sin_datos")) r.sinDatos++;
  }
  return r;
}
