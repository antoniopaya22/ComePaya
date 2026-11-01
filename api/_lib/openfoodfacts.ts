import type { NivelNutriente, Nutrientes100, ProductoExterno } from "../../src/dominio/producto-externo";

// Open Food Facts pide un User-Agent que identifique la app (§6). OFF_CONTACTO permite añadir un contacto.
const USER_AGENT = `Despensa/0.1 (${process.env.OFF_CONTACTO ?? "app doméstica"})`;

const CAMPOS = [
  "code",
  "product_name",
  "product_name_es",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "image_front_url",
  "image_url",
  "nutriments",
  "nutriscore_grade",
  "nova_group",
  "nutrient_levels",
  "additives_tags",
].join(",");

/** Busca un EAN en Open Food Facts. Devuelve null si no existe; lanza si el servicio falla. */
export async function buscarEnOpenFoodFacts(ean: string, fetchFn: typeof fetch = fetch): Promise<ProductoExterno | null> {
  const respuesta = await fetchFn(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=${CAMPOS}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`Open Food Facts respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as { status?: number; product?: ProductoOFF };
  if (datos.status !== 1 || !datos.product) return null;
  return normalizarProductoOFF(ean, datos.product);
}

export interface ProductoOFF {
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  image_front_url?: string;
  image_url?: string;
  nutriments?: Record<string, number | string | undefined>;
  nutriscore_grade?: string;
  nova_group?: number | string;
  nutrient_levels?: Record<string, string | undefined>;
  additives_tags?: string[];
}

const NUTRIENTES: [keyof Nutrientes100, string][] = [
  ["kcal", "energy-kcal_100g"],
  ["grasa", "fat_100g"],
  ["saturadas", "saturated-fat_100g"],
  ["hidratos", "carbohydrates_100g"],
  ["azucares", "sugars_100g"],
  ["fibra", "fiber_100g"],
  ["proteina", "proteins_100g"],
  ["sal", "salt_100g"],
];

const NIVELES: Record<string, NivelNutriente> = { low: "bajo", moderate: "moderado", high: "alto" };

export function normalizarProductoOFF(ean: string, p: ProductoOFF): ProductoExterno {
  const nombre = texto(p.product_name_es) ?? texto(p.product_name);
  const marca = texto(p.brands?.split(",")[0]);

  const nutrientes: Nutrientes100 = {};
  for (const [clave, campo] of NUTRIENTES) {
    const valor = numero(p.nutriments?.[campo]);
    if (valor !== null) nutrientes[clave] = valor;
  }
  const hayNutrientes = Object.keys(nutrientes).length > 0;

  const nutriscore = /^[a-e]$/.test(p.nutriscore_grade ?? "") ? (p.nutriscore_grade as ProductoExterno["nutriscore"]) : null;
  const novaNumero = numero(p.nova_group);
  const nova = novaNumero !== null && [1, 2, 3, 4].includes(novaNumero) ? (novaNumero as ProductoExterno["nova"]) : null;

  const niveles: NonNullable<ProductoExterno["niveles_nutrientes"]> = {};
  const origenNiveles = { grasa: "fat", saturadas: "saturated-fat", azucares: "sugars", sal: "salt" } as const;
  for (const [clave, campo] of Object.entries(origenNiveles) as [keyof typeof origenNiveles, string][]) {
    const nivel = NIVELES[p.nutrient_levels?.[campo] ?? ""];
    if (nivel) niveles[clave] = nivel;
  }

  const unidad = p.product_quantity_unit?.toLowerCase();
  const cantidadEnvase = numero(p.product_quantity);
  const unidadEnvase = unidad === "ml" || unidad === "l" || unidad === "cl" ? "ml" : unidad === "g" || unidad === "kg" || !unidad ? "g" : null;

  const claves = [
    nombre,
    marca,
    p.image_front_url ?? p.image_url,
    nutrientes.kcal,
    nutrientes.grasa,
    nutrientes.saturadas,
    nutrientes.azucares,
    nutrientes.sal,
    nutriscore,
    nova,
  ];

  return {
    ean,
    nombre,
    marca,
    cantidad_texto: texto(p.quantity),
    cantidad_envase: cantidadEnvase !== null && cantidadEnvase > 0 && unidadEnvase ? cantidadEnvase : null,
    unidad_envase: cantidadEnvase !== null && cantidadEnvase > 0 ? unidadEnvase : null,
    foto_url: texto(p.image_front_url) ?? texto(p.image_url),
    nutrientes_100: hayNutrientes ? nutrientes : null,
    nutriscore,
    nova,
    niveles_nutrientes: Object.keys(niveles).length ? niveles : null,
    aditivos: (p.additives_tags ?? []).map((tag) => tag.replace(/^en:/, "").toUpperCase()),
    completitud_datos: Math.round((claves.filter((v) => v !== null && v !== undefined).length / claves.length) * 100) / 100,
    fuente: "openfoodfacts",
  };
}

function texto(valor: string | undefined): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

function numero(valor: number | string | undefined): number | null {
  if (valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
