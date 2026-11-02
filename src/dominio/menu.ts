import { sumarDias, type FechaISO } from "./caducidad.js";

export type TipoFranja = "comida" | "cena";

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Lunes de la semana de una fecha (semana de lunes a domingo). */
export function lunesDe(fecha: FechaISO): FechaISO {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, -((diaSemana + 6) % 7));
}

export function diasDeSemana(lunes: FechaISO): FechaISO[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/** Cantidad de una receta pasada a otras raciones. */
export function escalar(cantidad: number, racionesReceta: number, racionesDestino: number): number {
  return (cantidad * racionesDestino) / racionesReceta;
}

export interface FranjaPlan {
  id: string;
  fecha: FechaISO;
  receta_id: string | null;
  raciones: number;
  fuera_de_casa: boolean;
  es_sobra_de: string | null;
  cocinado: boolean;
}

export interface RecetaPlan {
  raciones: number;
  ingredientes: { ingrediente_id: string; cantidad: number; opcional: boolean }[];
}

/**
 * Raciones a cocinar en cada franja: las suyas más las de las franjas que comen sus sobras (§3.6).
 * Las franjas de sobras, fuera de casa, sin receta o ya cocinadas no cocinan nada.
 */
export function racionesACocinar(franjas: FranjaPlan[]): Map<string, number> {
  const cocinan = new Map<string, number>();
  for (const f of franjas) {
    if (f.receta_id && !f.fuera_de_casa && !f.es_sobra_de && !f.cocinado) cocinan.set(f.id, f.raciones);
  }
  for (const f of franjas) {
    if (f.es_sobra_de && !f.fuera_de_casa && cocinan.has(f.es_sobra_de)) {
      cocinan.set(f.es_sobra_de, cocinan.get(f.es_sobra_de)! + f.raciones);
    }
  }
  return cocinan;
}

/**
 * Ingredientes que pide el menú (§3.2), en unidad base y ya escalados. Los opcionales no cuentan.
 * Solo las franjas desde `desde` (incluida): lo pasado y no marcado como cocinado se da por perdido.
 */
export function necesidadesDelMenu(franjas: FranjaPlan[], recetas: Map<string, RecetaPlan>, desde: FechaISO): Map<string, number> {
  const vigentes = franjas.filter((f) => f.fecha >= desde);
  const necesidades = new Map<string, number>();
  for (const [franjaId, raciones] of racionesACocinar(vigentes)) {
    const franja = vigentes.find((f) => f.id === franjaId)!;
    const receta = recetas.get(franja.receta_id!);
    if (!receta) continue;
    for (const ing of receta.ingredientes) {
      if (ing.opcional) continue;
      const cantidad = escalar(ing.cantidad, receta.raciones, raciones);
      necesidades.set(ing.ingrediente_id, (necesidades.get(ing.ingrediente_id) ?? 0) + cantidad);
    }
  }
  return necesidades;
}
