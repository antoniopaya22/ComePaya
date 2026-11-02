import { diasHasta, type FechaISO } from "./caducidad.js";
import { DIAS_SEMANA, escalar } from "./menu.js";
import { GRUPOS_ALIMENTO, type GrupoAlimento, type Regla } from "./nutricion.js";

// Puntuación explicable de recetas para una franja del menú (§9.1).

export interface Pesos {
  disponibilidad: number;
  caducidad: number;
  equilibrio: number;
  variedad: number;
  contexto: number;
  valoracion: number;
}

export const PESOS_POR_DEFECTO: Pesos = { disponibilidad: 3, caducidad: 2, equilibrio: 2, variedad: 1.5, contexto: 1, valoracion: 1 };

/** Peso de un ingrediente opcional frente a uno principal al medir la disponibilidad. */
const PESO_OPCIONAL = 0.3;

export interface RecetaSugerible {
  id: string;
  nombre: string;
  raciones: number;
  tiempo_prep_min: number | null;
  tiempo_coccion_min: number | null;
  valoracion: number | null;
  ingredientes: { ingrediente_id: string; cantidad: number; opcional: boolean }[];
}

export interface ContextoSugerencia {
  /** Día de la franja que se planifica. */
  fecha: FechaISO;
  /** Día real, para explicar las caducidades ("mañana", "el jueves"). */
  hoy: FechaISO;
  raciones: number;
  stock: Map<string, number>;
  basicos: Set<string>;
  /** Ingredientes con algún lote que caduca pronto: días que le quedan el día de la franja, nombre y fecha. */
  caducanPronto: Map<string, { dias: number; nombre: string; fecha: FechaISO }>;
  gruposPorReceta: Map<string, Set<GrupoAlimento>>;
  /** Comidas de la semana con cada grupo, sin contar la franja que se está planificando. */
  cuentaGrupos: Map<GrupoAlimento, number>;
  reglas: Regla[];
  /** Última fecha en que se comió o se planificó cada receta antes de `fecha`. */
  ultimaVez: Map<string, FechaISO>;
  /** Recetas rechazadas ("no me apetece") recientemente: no se sugieren. */
  rechazadas: Set<string>;
}

export interface Sugerencia {
  receta_id: string;
  nombre: string;
  puntos: number;
  /** Frases para mostrar, ordenadas por lo que más ha pesado. */
  motivos: string[];
}

interface Componente {
  valor: number;
  motivo?: string;
}

export function puntuarRecetas(recetas: RecetaSugerible[], ctx: ContextoSugerencia, pesos: Pesos = PESOS_POR_DEFECTO): Sugerencia[] {
  return recetas
    .filter((r) => !ctx.rechazadas.has(r.id))
    .map((r) => puntuar(r, ctx, pesos))
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, "es"));
}

function puntuar(receta: RecetaSugerible, ctx: ContextoSugerencia, pesos: Pesos): Sugerencia {
  const partes: [keyof Pesos, Componente][] = [
    ["disponibilidad", disponibilidad(receta, ctx)],
    ["caducidad", caducidad(receta, ctx)],
    ["equilibrio", equilibrio(receta, ctx)],
    ["variedad", variedad(receta, ctx)],
    ["contexto", contexto(receta, ctx)],
    ["valoracion", valoracion(receta)],
  ];
  const aportes = partes.map(([clave, c]) => ({ aporte: c.valor * pesos[clave], motivo: c.motivo }));
  const motivos = aportes
    .filter((a) => a.motivo)
    .sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte) || b.aporte - a.aporte)
    .map((a) => a.motivo!);
  return {
    receta_id: receta.id,
    nombre: receta.nombre,
    puntos: Math.round(aportes.reduce((t, a) => t + a.aporte, 0) * 100) / 100,
    motivos,
  };
}

function disponibilidad(receta: RecetaSugerible, ctx: ContextoSugerencia): Componente {
  let total = 0;
  let cubierto = 0;
  let faltan = 0;
  for (const ing of receta.ingredientes) {
    if (ctx.basicos.has(ing.ingrediente_id)) continue;
    const peso = ing.opcional ? PESO_OPCIONAL : 1;
    const necesario = escalar(ing.cantidad, receta.raciones, ctx.raciones);
    const fraccion = Math.min(1, (ctx.stock.get(ing.ingrediente_id) ?? 0) / necesario);
    total += peso;
    cubierto += peso * fraccion;
    if (!ing.opcional && fraccion < 1) faltan++;
  }
  if (!total) return { valor: 1 };
  const valor = cubierto / total;
  if (faltan === 0) return { valor, motivo: "Tienes todo en casa" };
  return { valor, motivo: faltan === 1 ? "Falta 1 ingrediente" : `Faltan ${faltan} ingredientes` };
}

function caducidad(receta: RecetaSugerible, ctx: ContextoSugerencia): Componente {
  let mejor: { valor: number; nombre: string; fecha: FechaISO } | null = null;
  for (const ing of receta.ingredientes) {
    const c = ctx.caducanPronto.get(ing.ingrediente_id);
    if (!c || c.dias < 0) continue;
    const valor = c.dias <= 1 ? 1 : c.dias <= 3 ? 0.6 : c.dias <= 5 ? 0.3 : 0;
    if (valor > (mejor?.valor ?? 0)) mejor = { valor, nombre: c.nombre, fecha: c.fecha };
  }
  if (!mejor) return { valor: 0 };
  return { valor: mejor.valor, motivo: `Usa ${mejor.nombre.toLowerCase()}, que caduca ${cuando(mejor.fecha, ctx.hoy)}` };
}

function equilibrio(receta: RecetaSugerible, ctx: ContextoSugerencia): Componente {
  let valor = 0;
  let motivo: string | undefined;
  for (const grupo of ctx.gruposPorReceta.get(receta.id) ?? []) {
    const regla = ctx.reglas.find((r) => r.grupo_alimento === grupo);
    if (!regla) continue;
    const n = ctx.cuentaGrupos.get(grupo) ?? 0;
    const nombre = GRUPOS_ALIMENTO.find((g) => g.valor === grupo)?.plural ?? grupo;
    if (regla.minimo_semana && n < regla.minimo_semana) {
      valor += 1;
      motivo ??= n === 0 ? `Esta semana no hay ${nombre}` : `Faltan comidas con ${nombre}`;
    }
    if (regla.maximo_semana !== null && n >= regla.maximo_semana) {
      valor -= 1;
      motivo = `Ya hay ${n} comidas con ${nombre} esta semana`;
    }
  }
  return { valor: Math.max(-1, Math.min(1, valor)), motivo };
}

function variedad(receta: RecetaSugerible, ctx: ContextoSugerencia): Componente {
  const ultima = ctx.ultimaVez.get(receta.id);
  if (!ultima) return { valor: 0.2 };
  const dias = diasHasta(ctx.fecha, ultima);
  if (dias < 7) return { valor: -1, motivo: dias <= 1 ? "La comisteis hace nada" : `La comisteis hace ${dias} días` };
  if (dias < 14) return { valor: -0.4 };
  return { valor: 0.2 };
}

function contexto(receta: RecetaSugerible, ctx: ContextoSugerencia): Componente {
  const minutos = (receta.tiempo_prep_min ?? 0) + (receta.tiempo_coccion_min ?? 0);
  if (!minutos) return { valor: 0 };
  const [a, m, d] = ctx.fecha.split("-").map(Number);
  const finDeSemana = [0, 6].includes(new Date(Date.UTC(a, m - 1, d)).getUTCDay());
  if (!finDeSemana && minutos > 45) return { valor: -1, motivo: `Lleva ${minutos} min y es entre semana` };
  if (!finDeSemana && minutos <= 30) return { valor: 0.5, motivo: `Rápida: ${minutos} min` };
  if (finDeSemana && minutos > 45) return { valor: 0.3, motivo: "Elaborada, para el fin de semana" };
  return { valor: 0 };
}

function valoracion(receta: RecetaSugerible): Componente {
  if (!receta.valoracion) return { valor: 0 };
  const valor = (receta.valoracion - 3) / 2;
  return { valor, motivo: receta.valoracion >= 4 ? `La valorasteis con ${receta.valoracion} estrellas` : undefined };
}

function cuando(fecha: FechaISO, hoy: FechaISO): string {
  const dias = diasHasta(fecha, hoy);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";
  const [a, m, d] = fecha.split("-").map(Number);
  if (dias < 7) return `el ${DIAS_SEMANA[(new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7].toLowerCase()}`;
  return `el ${d}/${m}`;
}
