import { sumarDias, type FechaISO } from "./caducidad.js";

// Los 14 alérgenos de declaración obligatoria en la UE, con las etiquetas que usa Open Food Facts.
export const ALERGENOS = [
  { valor: "en:gluten", etiqueta: "Gluten", emoji: "🌾" },
  { valor: "en:crustaceans", etiqueta: "Crustáceos", emoji: "🦐" },
  { valor: "en:eggs", etiqueta: "Huevo", emoji: "🥚" },
  { valor: "en:fish", etiqueta: "Pescado", emoji: "🐟" },
  { valor: "en:peanuts", etiqueta: "Cacahuete", emoji: "🥜" },
  { valor: "en:soybeans", etiqueta: "Soja", emoji: "🫘" },
  { valor: "en:milk", etiqueta: "Leche", emoji: "🥛" },
  { valor: "en:nuts", etiqueta: "Frutos de cáscara", emoji: "🌰" },
  { valor: "en:celery", etiqueta: "Apio", emoji: "🥬" },
  { valor: "en:mustard", etiqueta: "Mostaza", emoji: "🟡" },
  { valor: "en:sesame-seeds", etiqueta: "Sésamo", emoji: "⚪" },
  { valor: "en:sulphur-dioxide-and-sulphites", etiqueta: "Sulfitos", emoji: "🍷" },
  { valor: "en:lupin", etiqueta: "Altramuces", emoji: "🫛" },
  { valor: "en:molluscs", etiqueta: "Moluscos", emoji: "🦪" },
] as const;

export type Alergeno = (typeof ALERGENOS)[number]["valor"];

const CONOCIDOS = new Set<string>(ALERGENOS.map((a) => a.valor));

/** Se queda solo con los 14 alérgenos oficiales (Open Food Facts trae también trazas y otros). */
export function filtrarAlergenos(etiquetas: string[] | null | undefined): Alergeno[] {
  return [...new Set((etiquetas ?? []).filter((e) => CONOCIDOS.has(e)))] as Alergeno[];
}

export function etiquetaAlergeno(valor: string): string {
  return ALERGENOS.find((a) => a.valor === valor)?.etiqueta ?? valor;
}

/** Alérgenos de un ingrediente: los marcados a mano más los de cualquiera de sus productos. */
export function alergenosDeIngrediente(propios: string[] | null, deProductos: (string[] | null)[]): Alergeno[] {
  return filtrarAlergenos([...(propios ?? []), ...deProductos.flatMap((a) => a ?? [])]);
}

export interface AlergenosReceta {
  /** Los que lleva seguro (ingredientes no opcionales). */
  contiene: Alergeno[];
  /** Los que solo aparecen en ingredientes opcionales. */
  opcionales: Alergeno[];
}

export function alergenosDeReceta(lineas: { opcional: boolean; alergenos: Alergeno[] }[]): AlergenosReceta {
  const contiene = new Set(lineas.filter((l) => !l.opcional).flatMap((l) => l.alergenos));
  const opcionales = new Set(lineas.filter((l) => l.opcional).flatMap((l) => l.alergenos).filter((a) => !contiene.has(a)));
  return { contiene: ordenar(contiene), opcionales: ordenar(opcionales) };
}

/** Los alérgenos que afectan al hogar. */
export function conflictos(alergenos: readonly string[], delHogar: readonly string[]): Alergeno[] {
  const hogar = new Set(delHogar);
  return alergenos.filter((a) => hogar.has(a)) as Alergeno[];
}

function ordenar(conjunto: Set<Alergeno>): Alergeno[] {
  const orden = ALERGENOS.map((a) => a.valor as Alergeno);
  return [...conjunto].sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
}

export interface LoteAbrible {
  id: string;
  cantidad: number;
  fecha_caducidad: FechaISO | null;
}

export interface Apertura {
  /** El lote que queda abierto: el mismo si solo había un envase, o uno nuevo separado. */
  abierto: { id: string | null; cantidad: number; fecha_caducidad: FechaISO | null; abierto_en: FechaISO };
  /** Lo que queda cerrado del lote original (null si se abre entero). */
  restoCerrado: { id: string; cantidad: number } | null;
}

/**
 * Abrir un envase (producto abierto): pasa a caducar en `diasTrasAbrir` días, salvo que la fecha impresa sea antes.
 * Si el lote tiene varios envases, el abierto se separa en un lote nuevo y el resto sigue cerrado.
 */
export function abrirEnvase(lote: LoteAbrible, cantidadEnvase: number | null, diasTrasAbrir: number | null, hoy: FechaISO): Apertura {
  const envase = cantidadEnvase && cantidadEnvase < lote.cantidad ? cantidadEnvase : lote.cantidad;
  const limite = diasTrasAbrir ? sumarDias(hoy, diasTrasAbrir) : null;
  const fecha = !limite ? lote.fecha_caducidad : !lote.fecha_caducidad || limite < lote.fecha_caducidad ? limite : lote.fecha_caducidad;
  const separa = envase < lote.cantidad;
  return {
    abierto: { id: separa ? null : lote.id, cantidad: envase, fecha_caducidad: fecha, abierto_en: hoy },
    restoCerrado: separa ? { id: lote.id, cantidad: Math.round((lote.cantidad - envase) * 1000) / 1000 } : null,
  };
}
