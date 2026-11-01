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
 * sueltas se muestran tal cual ("400 g", "6 ud"): "0,5 × 12 ud" no lo entiende nadie.
 */
export function formatearLote(cantidad: number, unidad: UnidadBase, cantidadEnvase: number | null): string {
  if (!cantidadEnvase || unidad === "ud" || cantidad === cantidadEnvase) return formatearCantidad(cantidad, unidad);
  return `${numero.format(cantidad / cantidadEnvase)} × ${formatearCantidad(cantidadEnvase, unidad)}`;
}

/** Envases → unidad base (lo que se guarda en la base de datos). */
export function envasesABase(envases: number, cantidadEnvase: number | null): number {
  return envases * (cantidadEnvase ?? 1);
}

/** Cuántos envases enteros o fraccionarios hay en una cantidad en unidad base. */
export function baseAEnvases(cantidad: number, cantidadEnvase: number | null): number {
  return cantidad / (cantidadEnvase ?? 1);
}
