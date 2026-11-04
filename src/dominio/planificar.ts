import { diasHasta, type FechaISO } from "./caducidad.js";
import { escalar, type TipoFranja } from "./menu.js";
import type { GrupoAlimento } from "./nutricion.js";
import { puntuarRecetas, type ContextoSugerencia, type Pesos, type RecetaSugerible } from "./sugerencias.js";

export interface Hueco {
  fecha: FechaISO;
  tipo: TipoFranja;
  raciones: number;
}

export interface Propuesta extends Hueco {
  receta_id: string;
  nombre: string;
  motivos: string[];
}

/** Lo común a toda la semana; lo que cambia por hueco (fecha, raciones…) lo calcula el planificador. */
export type ContextoSemana = Omit<ContextoSugerencia, "fecha" | "raciones">;

/**
 * Planificación automática (§9.3), algoritmo voraz: rellena los huecos en orden y, tras cada elección,
 * descuenta lo que gasta del stock, suma sus grupos de alimentos y la marca como reciente (variedad).
 * Así la segunda comida no cuenta con el chorizo que ya usó la primera ni repite plato.
 */
export function planificarSemana(huecos: Hueco[], recetas: RecetaSugerible[], base: ContextoSemana, pesos?: Pesos): Propuesta[] {
  const stock = new Map(base.stock);
  const cuentaGrupos = new Map(base.cuentaGrupos);
  const ultimaVez = new Map(base.ultimaVez);
  const propuestas: Propuesta[] = [];

  const ordenados = [...huecos].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === b.tipo ? 0 : a.tipo === "comida" ? -1 : 1));
  for (const hueco of ordenados) {
    // Las caducidades se miden desde el día del hueco: lo que ya habrá caducado no cuenta,
    // ni lo que ya se han gastado los huecos anteriores.
    const caducanPronto = new Map(
      [...base.caducanPronto]
        .map(([id, c]) => [id, { ...c, dias: diasHasta(c.fecha, hueco.fecha) }] as const)
        .filter(([id, c]) => c.dias >= 0 && (stock.get(id) ?? 0) > 0),
    );
    // No repetir plato en la semana mientras haya otros (las sobras ya se planifican aparte).
    const sinRepetir = recetas.filter((r) => !propuestas.some((p) => p.receta_id === r.id));
    const [mejor] = puntuarRecetas(sinRepetir.length ? sinRepetir : recetas, { ...base, fecha: hueco.fecha, raciones: hueco.raciones, stock, cuentaGrupos, ultimaVez, caducanPronto }, pesos);
    if (!mejor) break;
    propuestas.push({ ...hueco, receta_id: mejor.receta_id, nombre: mejor.nombre, motivos: mejor.motivos });

    const receta = recetas.find((r) => r.id === mejor.receta_id)!;
    for (const ing of receta.ingredientes) {
      if (ing.opcional || base.basicos.has(ing.ingrediente_id)) continue;
      const usado = escalar(ing.cantidad, receta.raciones, hueco.raciones);
      stock.set(ing.ingrediente_id, Math.max(0, (stock.get(ing.ingrediente_id) ?? 0) - usado));
    }
    for (const g of base.gruposPorReceta.get(receta.id) ?? new Set<GrupoAlimento>()) cuentaGrupos.set(g, (cuentaGrupos.get(g) ?? 0) + 1);
    ultimaVez.set(receta.id, hueco.fecha);
  }
  return propuestas;
}
