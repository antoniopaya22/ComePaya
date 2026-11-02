import type { FechaISO } from "./caducidad.js";
import { lunesDe } from "./menu.js";
import { contarGrupos, evaluarEquilibrio, type GrupoAlimento, type Regla } from "./nutricion.js";

// Estadísticas (§4.7): desperdicio, platos más cocinados y cumplimiento de las reglas semanales.

export interface MovimientoTirado {
  producto: string;
  motivo: string | null;
}

/** Productos más tirados (por número de veces). */
export function masTirados(movimientos: MovimientoTirado[], limite = 5): { producto: string; veces: number }[] {
  const cuenta = new Map<string, number>();
  for (const m of movimientos) cuenta.set(m.producto, (cuenta.get(m.producto) ?? 0) + 1);
  return [...cuenta.entries()]
    .map(([producto, veces]) => ({ producto, veces }))
    .sort((a, b) => b.veces - a.veces || a.producto.localeCompare(b.producto, "es"))
    .slice(0, limite);
}

export interface FranjaHistorica {
  fecha: FechaISO;
  receta_id: string | null;
  fuera_de_casa: boolean;
  es_sobra_de: string | null;
  cocinado: boolean;
}

/** Recetas más cocinadas (las sobras no cuentan como otra vez). */
export function masCocinadas(franjas: FranjaHistorica[], limite = 5): { receta_id: string; veces: number }[] {
  const cuenta = new Map<string, number>();
  for (const f of franjas) {
    if (f.cocinado && f.receta_id && !f.es_sobra_de) cuenta.set(f.receta_id, (cuenta.get(f.receta_id) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([receta_id, veces]) => ({ receta_id, veces }))
    .sort((a, b) => b.veces - a.veces)
    .slice(0, limite);
}

/** Por cada semana con algo planificado: si cumplió todas las reglas y cuántos avisos tuvo. */
export function cumplimientoSemanal(
  franjas: FranjaHistorica[],
  gruposPorReceta: Map<string, Set<GrupoAlimento>>,
  reglas: Regla[],
): { lunes: FechaISO; avisos: number; cumple: boolean }[] {
  const porSemana = new Map<FechaISO, FranjaHistorica[]>();
  for (const f of franjas) {
    if (!f.receta_id || f.fuera_de_casa) continue;
    const lunes = lunesDe(f.fecha);
    porSemana.set(lunes, [...(porSemana.get(lunes) ?? []), f]);
  }
  return [...porSemana.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lunes, lista]) => {
      const avisos = evaluarEquilibrio(contarGrupos(lista, gruposPorReceta), reglas).length;
      return { lunes, avisos, cumple: avisos === 0 };
    });
}
