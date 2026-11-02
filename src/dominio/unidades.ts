/** Unidad base de un ingrediente (§5): todas las cantidades internas se guardan en ella. */
export type UnidadBase = "g" | "ml" | "ud";

export const UNIDADES_BASE: { valor: UnidadBase; etiqueta: string }[] = [
  { valor: "g", etiqueta: "Gramos" },
  { valor: "ml", etiqueta: "Mililitros" },
  { valor: "ud", etiqueta: "Unidades" },
];

const numero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

/** 1500 g → "1,5 kg"; 250 ml → "250 ml"; 3 ud → "3 ud". */
export function formatearCantidad(cantidad: number, unidad: UnidadBase): string {
  if (unidad === "g" && Math.abs(cantidad) >= 1000) return `${numero.format(cantidad / 1000)} kg`;
  if (unidad === "ml" && Math.abs(cantidad) >= 1000) return `${numero.format(cantidad / 1000)} l`;
  return `${numero.format(cantidad)} ${unidad}`;
}

/**
 * Cantidad legible de un lote. Con varios envases en g o ml se muestran los envases:
 * 800 g con envase de 400 g → "2 × 400 g"; 600 g → "1,5 × 400 g". Un envase o las unidades
 * sueltas, o menos de un envase, se muestran tal cual ("400 g", "6 ud", "500 ml"): "0,5 × 12 ud" no lo entiende nadie.
 */
export function formatearLote(cantidad: number, unidad: UnidadBase, cantidadEnvase: number | null): string {
  // Menos de un envase (uno empezado): "500 ml" se entiende mejor que "0,5 × 1 l".
  if (!cantidadEnvase || unidad === "ud" || cantidad <= cantidadEnvase) return formatearCantidad(cantidad, unidad);
  return `${numero.format(cantidad / cantidadEnvase)} × ${formatearCantidad(cantidadEnvase, unidad)}`;
}

/** Medidas caseras y su equivalencia por defecto en ml (para ingredientes en g se toma densidad 1). */
export const MEDIDAS_CASERAS = [
  { valor: "cucharada", etiqueta: "cda", nombre: "cucharada", porDefecto: 15 },
  { valor: "cucharadita", etiqueta: "cdta", nombre: "cucharadita", porDefecto: 5 },
  { valor: "vaso", etiqueta: "vaso", nombre: "vaso", porDefecto: 200 },
  { valor: "taza", etiqueta: "taza", nombre: "taza", porDefecto: 240 },
  { valor: "pizca", etiqueta: "pizca", nombre: "pizca", porDefecto: 0.5 },
] as const;

export type MedidaCasera = (typeof MEDIDAS_CASERAS)[number]["valor"];

/**
 * Cuánto es una medida casera en la unidad base del ingrediente. Usa la equivalencia propia del ingrediente
 * (una cucharada de harina son ~8 g, no 15) o la de por defecto. Los que se cuentan por unidades no admiten medidas.
 */
export function equivalencia(medida: MedidaCasera, unidad: UnidadBase, propias: Record<string, number> | null): number | null {
  if (unidad === "ud") return null;
  return propias?.[medida] ?? MEDIDAS_CASERAS.find((m) => m.valor === medida)!.porDefecto;
}

/** "2 cucharadas" de un ingrediente → cantidad en su unidad base (redondeada a 0,1). */
export function medidaABase(cantidad: number, medida: MedidaCasera, unidad: UnidadBase, propias: Record<string, number> | null): number | null {
  const factor = equivalencia(medida, unidad, propias);
  return factor === null ? null : Math.round(cantidad * factor * 10) / 10;
}

/** Envases → unidad base (lo que se guarda en la base de datos). */
export function envasesABase(envases: number, cantidadEnvase: number | null): number {
  return envases * (cantidadEnvase ?? 1);
}

/** Cuántos envases enteros o fraccionarios hay en una cantidad en unidad base. */
export function baseAEnvases(cantidad: number, cantidadEnvase: number | null): number {
  return cantidad / (cantidadEnvase ?? 1);
}
