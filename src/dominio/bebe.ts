import type { FechaISO } from "./caducidad.js";
import { normalizar } from "./texto.js";

/** De quién es una franja del menú: de la casa o del bebé (comida y cena propias). */
export type ParaFranja = "casa" | "bebe";

/** Etiqueta de las recetas para el bebé (purés, papillas…). */
export const ETIQUETA_BEBE = "bebé";

export function esRecetaDeBebe(receta: { etiquetas: string[] }): boolean {
  return receta.etiquetas.some((e) => normalizar(e) === "bebe");
}

/** Las franjas antiguas no tienen `para`: son de la casa. */
export function paraDe(franja: { para?: ParaFranja | null }): ParaFranja {
  return franja.para ?? "casa";
}

/**
 * Recetas que encajan en una franja: las de bebé para el bebé y el resto para la casa.
 * Si aún no hay ninguna receta de bebé, para el bebé valen todas.
 */
export function recetasPara<R extends { etiquetas: string[] }>(para: ParaFranja, recetas: R[]): R[] {
  if (para === "casa") return recetas.filter((r) => !esRecetaDeBebe(r));
  const deBebe = recetas.filter(esRecetaDeBebe);
  return deBebe.length ? deBebe : recetas;
}

/** Ingredientes de una receta que el bebé aún no ha probado (sin los opcionales ni repetidos). */
export function alimentosNuevos(ingredientes: { ingrediente_id: string; opcional: boolean }[], introducidos: Map<string, FechaISO | null>): string[] {
  const nuevos = new Set<string>();
  for (const i of ingredientes) if (!i.opcional && !introducidos.get(i.ingrediente_id)) nuevos.add(i.ingrediente_id);
  return [...nuevos];
}

/** "Lucía" → "Lucía"; vacío o solo espacios → null (sin menú de bebé). */
export function limpiarNombreBebe(nombre: string): string | null {
  const limpio = nombre.trim().replace(/\s+/g, " ").slice(0, 40);
  return limpio || null;
}
