import type { UnidadBase } from "./unidades";

// Importar recetas de webs que publican datos estructurados schema.org/Recipe (JSON-LD).
// No genera nada: copia lo que la web publica y lo deja en el editor para revisarlo.

export interface RecetaWeb {
  nombre: string;
  raciones: number | null;
  tiempo_prep_min: number | null;
  tiempo_coccion_min: number | null;
  ingredientes: string[];
  pasos: string[];
  imagen: string | null;
}

/** Busca un objeto Recipe en los bloques JSON-LD de una página. Devuelve null si no hay. */
export function extraerRecetaJsonLd(html: string): RecetaWeb | null {
  const bloques = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const bloque of bloques) {
    let datos: unknown;
    try {
      datos = JSON.parse(bloque.trim());
    } catch {
      continue;
    }
    const receta = buscarReceta(datos);
    if (receta) return normalizar(receta);
  }
  return null;
}

type Objeto = Record<string, unknown>;

function buscarReceta(nodo: unknown): Objeto | null {
  if (Array.isArray(nodo)) {
    for (const n of nodo) {
      const r = buscarReceta(n);
      if (r) return r;
    }
    return null;
  }
  if (!nodo || typeof nodo !== "object") return null;
  const obj = nodo as Objeto;
  const tipo = obj["@type"];
  if (tipo === "Recipe" || (Array.isArray(tipo) && tipo.includes("Recipe"))) return obj;
  return buscarReceta(obj["@graph"]);
}

function normalizar(r: Objeto): RecetaWeb {
  return {
    nombre: limpiar(String(r.name ?? "Receta importada")),
    raciones: racionesDe(r.recipeYield),
    tiempo_prep_min: duracionMinutos(r.prepTime),
    tiempo_coccion_min: duracionMinutos(r.cookTime),
    ingredientes: (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map((i) => limpiar(String(i))).filter(Boolean),
    pasos: pasosDe(r.recipeInstructions),
    imagen: imagenDe(r.image),
  };
}

function pasosDe(nodo: unknown): string[] {
  if (!nodo) return [];
  if (typeof nodo === "string") {
    return limpiar(nodo.replace(/<\/(p|li)>/gi, "\n"), true)
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (Array.isArray(nodo)) return nodo.flatMap(pasosDe);
  const obj = nodo as Objeto;
  if (obj["@type"] === "HowToSection") return pasosDe(obj.itemListElement);
  if (typeof obj.text === "string") return [limpiar(obj.text)];
  if (typeof obj.name === "string") return [limpiar(obj.name)];
  return [];
}

function imagenDe(nodo: unknown): string | null {
  if (!nodo) return null;
  if (typeof nodo === "string") return nodo;
  if (Array.isArray(nodo)) return imagenDe(nodo[0]);
  const url = (nodo as Objeto).url;
  return typeof url === "string" ? url : null;
}

function racionesDe(nodo: unknown): number | null {
  const valor = Array.isArray(nodo) ? nodo[0] : nodo;
  const n = /\d+/.exec(String(valor ?? ""));
  return n ? Math.min(50, Number(n[0])) || null : null;
}

/** Duración ISO 8601 (PT1H30M) a minutos. */
export function duracionMinutos(nodo: unknown): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(nodo ?? "").trim());
  if (!m) return null;
  const minutos = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return minutos || null;
}

function limpiar(texto: string, conservarSaltos = false): string {
  const sinEtiquetas = texto
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return conservarSaltos ? sinEtiquetas.replace(/[ \t]+/g, " ").trim() : sinEtiquetas.replace(/\s+/g, " ").trim();
}

export interface LineaIngrediente {
  original: string;
  nombre: string;
  cantidad: number | null;
  unidad: UnidadBase;
  /** Si la cantidad viene de una equivalencia aproximada (cucharada, vaso…) y conviene revisarla. */
  aproximada: boolean;
}

// Medidas caseras → unidad base, aproximadas. El editor marca la línea para que se revise.
const MEDIDAS: { patron: RegExp; factor: number; unidad: UnidadBase; aproximada: boolean }[] = [
  { patron: /^(kg|kilos?|kilogramos?)$/i, factor: 1000, unidad: "g", aproximada: false },
  { patron: /^(g|gr|grs|gramos?)$/i, factor: 1, unidad: "g", aproximada: false },
  { patron: /^(l|litros?)$/i, factor: 1000, unidad: "ml", aproximada: false },
  { patron: /^(dl|decilitros?)$/i, factor: 100, unidad: "ml", aproximada: false },
  { patron: /^(cl|centilitros?)$/i, factor: 10, unidad: "ml", aproximada: false },
  { patron: /^(ml|mililitros?)$/i, factor: 1, unidad: "ml", aproximada: false },
  { patron: /^(cucharadas?|cda|cdas)$/i, factor: 15, unidad: "ml", aproximada: true },
  { patron: /^(cucharaditas?|cdta|cdtas|cdita)$/i, factor: 5, unidad: "ml", aproximada: true },
  { patron: /^(vasos?)$/i, factor: 200, unidad: "ml", aproximada: true },
  { patron: /^(tazas?)$/i, factor: 240, unidad: "ml", aproximada: true },
  { patron: /^(pizcas?|pellizcos?)$/i, factor: 1, unidad: "g", aproximada: true },
  { patron: /^(dientes?|unidades?|uds?|piezas?|rodajas?|hojas?|ramitas?|latas?|botes?|sobres?|filetes?|lonchas?)$/i, factor: 1, unidad: "ud", aproximada: false },
];

const FRACCIONES: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

/**
 * "400 g de lentejas" → 400 g Lentejas; "2 cucharadas de aceite" → 30 ml Aceite (aproximada);
 * "1/2 kg de patatas" → 500 g Patatas; "sal al gusto" → sin cantidad.
 */
export function parsearLineaIngrediente(original: string): LineaIngrediente {
  // "1 ½" → "1.5"; "½" → "0.5"
  const texto = original
    .replace(/\(.*?\)/g, " ")
    .replace(/(\d+)?\s*([½¼¾⅓⅔])/g, (_, entero: string | undefined, fraccion: string) => ` ${Number(entero ?? 0) + FRACCIONES[fraccion]} `)
    .replace(/\s+/g, " ")
    .trim();

  // Primero "1 1/2", luego "1/2", luego "1,5" o "2".
  const numero = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*/.exec(texto);
  let cantidad: number | null = null;
  let resto = texto.trim();
  if (numero) {
    cantidad = numero[1].split(/\s+/).reduce((t, parte) => {
      if (parte.includes("/")) {
        const [a, b] = parte.split("/").map(Number);
        return t + a / b;
      }
      return t + Number(parte.replace(",", "."));
    }, 0);
    resto = resto.slice(numero[0].length);
  } else if (/^(un|una)\s/i.test(resto)) {
    cantidad = 1;
    resto = resto.replace(/^(un|una)\s+/i, "");
  }

  let unidad: UnidadBase = "ud";
  let aproximada = false;
  const palabra = /^([a-záéíóúñ]+)\.?\s*/i.exec(resto);
  const medida = palabra ? MEDIDAS.find((m) => m.patron.test(palabra[1])) : undefined;
  if (medida && palabra) {
    resto = resto.slice(palabra[0].length);
    unidad = medida.unidad;
    aproximada = medida.aproximada;
    if (cantidad !== null) cantidad = Math.round(cantidad * medida.factor * 100) / 100;
    else cantidad = medida.factor;
  }

  const nombre = resto
    .replace(/^(de|del)\s+/i, "")
    .replace(/,.*$/, "")
    .replace(/\s+(al gusto|a gusto|c\/n|cantidad necesaria)$/i, "")
    .trim();
  return {
    original,
    nombre: nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : original,
    cantidad: cantidad && cantidad > 0 ? cantidad : null,
    unidad,
    aproximada,
  };
}
