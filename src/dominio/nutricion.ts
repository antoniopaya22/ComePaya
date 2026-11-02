import type { Nutrientes100 } from "./producto-externo.js";
import type { UnidadBase } from "./unidades.js";

export type GrupoAlimento =
  | "legumbre"
  | "pescado"
  | "carne_roja"
  | "carne_blanca"
  | "huevo"
  | "verdura"
  | "fruta"
  | "cereal"
  | "lacteo"
  | "ultraprocesado";

export const GRUPOS_ALIMENTO: { valor: GrupoAlimento; etiqueta: string; plural: string }[] = [
  { valor: "legumbre", etiqueta: "Legumbre", plural: "legumbres" },
  { valor: "pescado", etiqueta: "Pescado", plural: "pescado" },
  { valor: "carne_roja", etiqueta: "Carne roja", plural: "carne roja" },
  { valor: "carne_blanca", etiqueta: "Carne blanca", plural: "carne blanca" },
  { valor: "huevo", etiqueta: "Huevo", plural: "huevo" },
  { valor: "verdura", etiqueta: "Verdura", plural: "verdura" },
  { valor: "fruta", etiqueta: "Fruta", plural: "fruta" },
  { valor: "cereal", etiqueta: "Cereal", plural: "cereales" },
  { valor: "lacteo", etiqueta: "Lácteo", plural: "lácteos" },
  { valor: "ultraprocesado", etiqueta: "Ultraprocesado", plural: "ultraprocesados" },
];

export interface Regla {
  grupo_alimento: GrupoAlimento;
  minimo_semana: number | null;
  maximo_semana: number | null;
}

/**
 * Reglas por defecto para las 14 comidas y cenas de la semana, a partir de las recomendaciones de la AESAN
 * (legumbre y pescado varias veces por semana, limitar carne roja y ultraprocesados). Son orientativas y editables.
 */
export const REGLAS_POR_DEFECTO: Regla[] = [
  { grupo_alimento: "legumbre", minimo_semana: 3, maximo_semana: null },
  { grupo_alimento: "pescado", minimo_semana: 3, maximo_semana: null },
  { grupo_alimento: "verdura", minimo_semana: 7, maximo_semana: null },
  { grupo_alimento: "huevo", minimo_semana: null, maximo_semana: 4 },
  { grupo_alimento: "carne_roja", minimo_semana: null, maximo_semana: 2 },
  { grupo_alimento: "ultraprocesado", minimo_semana: null, maximo_semana: 2 },
];

export const CLAVES_NUTRIENTES: { clave: keyof Nutrientes100; etiqueta: string; unidad: string }[] = [
  { clave: "kcal", etiqueta: "Energía", unidad: "kcal" },
  { clave: "proteina", etiqueta: "Proteína", unidad: "g" },
  { clave: "grasa", etiqueta: "Grasa", unidad: "g" },
  { clave: "saturadas", etiqueta: "Saturadas", unidad: "g" },
  { clave: "hidratos", etiqueta: "Hidratos", unidad: "g" },
  { clave: "azucares", etiqueta: "Azúcares", unidad: "g" },
  { clave: "fibra", etiqueta: "Fibra", unidad: "g" },
  { clave: "sal", etiqueta: "Sal", unidad: "g" },
];

/**
 * Nutrientes por 100 g de un ingrediente: los que el usuario haya puesto a mano; si no, la media de sus
 * productos con datos (§5). Cada nutriente se promedia solo entre los productos que lo tienen.
 */
export function nutrientesDeIngrediente(manuales: Nutrientes100 | null, deProductos: (Nutrientes100 | null)[]): Nutrientes100 | null {
  if (manuales && Object.keys(manuales).length) return manuales;
  const conDatos = deProductos.filter((n): n is Nutrientes100 => Boolean(n && Object.keys(n).length));
  if (!conDatos.length) return null;
  const media: Nutrientes100 = {};
  for (const { clave } of CLAVES_NUTRIENTES) {
    const valores = conDatos.map((n) => n[clave]).filter((v): v is number => typeof v === "number");
    if (valores.length) media[clave] = redondear(valores.reduce((a, b) => a + b, 0) / valores.length);
  }
  return media;
}

export interface IngredienteNutricion {
  nombre: string;
  unidad_base: UnidadBase;
  peso_unidad_g: number | null;
  nutrientes_100: Nutrientes100 | null;
}

export interface NutricionReceta {
  porRacion: Nutrientes100;
  /** Ingredientes sin datos o sin peso por unidad: el cálculo los ignora y hay que decirlo. */
  sinDatos: string[];
}

/**
 * Nutrientes por ración de una receta (§8.2): suma de cada ingrediente según su cantidad. Los mililitros se
 * cuentan como gramos (aproximación razonable para cocina doméstica). Los opcionales no cuentan.
 * No se calcula Nutri-Score de platos caseros: no está diseñado para eso.
 */
export function nutricionPorRacion(
  raciones: number,
  lineas: { cantidad: number; opcional: boolean; ingrediente: IngredienteNutricion }[],
): NutricionReceta {
  const total: Nutrientes100 = {};
  const sinDatos: string[] = [];
  for (const { cantidad, opcional, ingrediente } of lineas) {
    if (opcional) continue;
    const gramos = ingrediente.unidad_base === "ud" ? (ingrediente.peso_unidad_g ? cantidad * ingrediente.peso_unidad_g : null) : cantidad;
    const n = ingrediente.nutrientes_100;
    if (gramos === null || !n || !Object.keys(n).length) {
      sinDatos.push(ingrediente.nombre);
      continue;
    }
    for (const { clave } of CLAVES_NUTRIENTES) {
      const valor = n[clave];
      if (typeof valor === "number") total[clave] = (total[clave] ?? 0) + (valor * gramos) / 100;
    }
  }
  const porRacion: Nutrientes100 = {};
  for (const [clave, valor] of Object.entries(total) as [keyof Nutrientes100, number][]) porRacion[clave] = redondear(valor / raciones);
  return { porRacion, sinDatos };
}

/** Grupos de alimentos de una receta: los de sus ingredientes no opcionales. */
export function gruposDeReceta(lineas: { opcional: boolean; grupo: GrupoAlimento | null }[]): Set<GrupoAlimento> {
  return new Set(lineas.filter((l) => !l.opcional && l.grupo).map((l) => l.grupo!));
}

export interface ComidaPlanificada {
  receta_id: string | null;
  fuera_de_casa: boolean;
}

/** Cuántas comidas y cenas de la semana llevan cada grupo (las sobras cuentan: también se comen). */
export function contarGrupos(franjas: ComidaPlanificada[], gruposPorReceta: Map<string, Set<GrupoAlimento>>): Map<GrupoAlimento, number> {
  const cuenta = new Map<GrupoAlimento, number>();
  for (const f of franjas) {
    if (f.fuera_de_casa || !f.receta_id) continue;
    for (const g of gruposPorReceta.get(f.receta_id) ?? []) cuenta.set(g, (cuenta.get(g) ?? 0) + 1);
  }
  return cuenta;
}

export interface AvisoEquilibrio {
  grupo: GrupoAlimento;
  tipo: "falta" | "exceso";
  mensaje: string;
}

/** Avisos del equilibrio semanal (§8.3): "Esta semana no hay pescado", "3 comidas con ultraprocesados (máx. 2)". */
export function evaluarEquilibrio(cuenta: Map<GrupoAlimento, number>, reglas: Regla[]): AvisoEquilibrio[] {
  const avisos: AvisoEquilibrio[] = [];
  for (const r of reglas) {
    const n = cuenta.get(r.grupo_alimento) ?? 0;
    const nombre = GRUPOS_ALIMENTO.find((g) => g.valor === r.grupo_alimento)?.plural ?? r.grupo_alimento;
    if (r.minimo_semana && n < r.minimo_semana) {
      avisos.push({
        grupo: r.grupo_alimento,
        tipo: "falta",
        mensaje: n === 0 ? `Esta semana no hay ${nombre}` : `Solo ${n} ${n === 1 ? "comida" : "comidas"} con ${nombre} (mín. ${r.minimo_semana})`,
      });
    }
    if (r.maximo_semana !== null && n > r.maximo_semana) {
      avisos.push({ grupo: r.grupo_alimento, tipo: "exceso", mensaje: `${n} comidas con ${nombre} (máx. ${r.maximo_semana})` });
    }
  }
  return avisos;
}

/** Aditivos de un producto que el hogar quiere vigilar (comparación sin distinguir mayúsculas). */
export function aditivosVigilados(aditivos: string[], vigilados: string[]): string[] {
  const set = new Set(vigilados.map((v) => v.trim().toUpperCase()));
  return aditivos.filter((a) => set.has(a.toUpperCase()));
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}
