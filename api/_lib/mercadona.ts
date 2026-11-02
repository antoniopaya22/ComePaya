import type { ProductoExterno } from "../../src/dominio/producto-externo.js";

// API no oficial de Mercadona (§6): aislada aquí, con tiempos de espera cortos y sin romper nada si falla.
// La búsqueda usa el Algolia público de la tienda online (credenciales de solo lectura que publica su web).

const ALGOLIA_APP = process.env.MERCADONA_ALGOLIA_APP ?? "7UZJKL1DJ0";
const ALGOLIA_CLAVE = process.env.MERCADONA_ALGOLIA_CLAVE ?? "9d8f2e39e90df472b4f2e559a116fe17";
// El surtido depende del almacén (vlc1, mad1, bcn1…): hay formatos que solo se venden en algunas zonas
// (los nachos de 200 g, en Madrid y Barcelona pero no en Valencia), así que se consulta en varios.
const ALMACENES = (process.env.MERCADONA_ALMACENES ?? process.env.MERCADONA_ALMACEN ?? "vlc1,mad1,bcn1")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);

/**
 * Productos de Mercadona con código de otro fabricante (no empiezan por 8480000): código de barras → id en Mercadona.
 * Para que se reconozcan al escanear aunque no estén en Open Food Facts. Se comprueba siempre contra la ficha.
 */
export const CODIGOS_CONOCIDOS: Record<string, string> = {
  "8402001058011": "17754", // Nachos Hacendado 200 g
};

export interface ResultadoMercadona {
  mercadona_id: string;
  nombre: string;
  marca: string | null;
  envase_texto: string | null;
  cantidad_envase: number | null;
  unidad_envase: "g" | "ml" | null;
  foto_url: string | null;
  precio: number | null;
}

interface HitMercadona {
  id: string;
  display_name: string;
  brand?: string | null;
  packaging?: string | null;
  thumbnail?: string | null;
  price_instructions?: { unit_size?: number | null; size_format?: string | null; unit_price?: string | null };
}

async function buscarEnAlmacen(almacen: string, texto: string, fetchFn: typeof fetch): Promise<HitMercadona[]> {
  const respuesta = await fetchFn(`https://${ALGOLIA_APP.toLowerCase()}-dsn.algolia.net/1/indexes/products_prod_${almacen}_es/query`, {
    method: "POST",
    headers: { "x-algolia-application-id": ALGOLIA_APP, "x-algolia-api-key": ALGOLIA_CLAVE, "Content-Type": "application/json" },
    body: JSON.stringify({ query: texto, hitsPerPage: 8 }),
    signal: AbortSignal.timeout(5000),
  });
  if (!respuesta.ok) throw new Error(`Mercadona respondió ${respuesta.status}`);
  return ((await respuesta.json()) as { hits?: HitMercadona[] }).hits ?? [];
}

/** Busca en todos los almacenes a la vez y junta los resultados sin repetir. Lanza solo si fallan todos. */
export async function buscarEnMercadona(texto: string, fetchFn: typeof fetch = fetch): Promise<ResultadoMercadona[]> {
  const respuestas = await Promise.allSettled(ALMACENES.map((a) => buscarEnAlmacen(a, texto, fetchFn)));
  const correctas = respuestas.filter((r): r is PromiseFulfilledResult<HitMercadona[]> => r.status === "fulfilled");
  if (!correctas.length) throw (respuestas[0] as PromiseRejectedResult).reason;
  const vistos = new Set<string>();
  const unicos: HitMercadona[] = [];
  for (const hit of correctas.flatMap((r) => r.value)) {
    if (vistos.has(String(hit.id))) continue;
    vistos.add(String(hit.id));
    unicos.push(hit);
  }
  return unicos.slice(0, 10).map(normalizarHitMercadona);
}

export function normalizarHitMercadona(hit: HitMercadona): ResultadoMercadona {
  const { cantidad, unidad } = envase(hit.price_instructions?.unit_size, hit.price_instructions?.size_format);
  const formato = hit.price_instructions?.size_format?.toLowerCase();
  const precio = Number(hit.price_instructions?.unit_price);
  return {
    mercadona_id: String(hit.id),
    nombre: hit.display_name.trim(),
    marca: hit.brand?.trim() || null,
    envase_texto: [hit.packaging, hit.price_instructions?.unit_size && formato ? `${String(hit.price_instructions.unit_size).replace(".", ",")} ${formato}` : null]
      .filter(Boolean)
      .join(" ") || null,
    cantidad_envase: cantidad,
    unidad_envase: unidad,
    foto_url: hit.thumbnail ?? null,
    precio: Number.isFinite(precio) && precio > 0 ? precio : null,
  };
}

interface DetalleMercadona extends HitMercadona {
  ean?: string | null;
  photos?: { regular?: string; thumbnail?: string }[];
}

/** Ficha de un producto de Mercadona por su id, con su código de barras. Prueba en cada almacén; null si no está en ninguno. */
export async function obtenerProductoMercadona(id: string, fetchFn: typeof fetch = fetch): Promise<(ResultadoMercadona & { ean: string | null }) | null> {
  if (!/^\d+(\.\d+)?$/.test(id)) return null;
  let fallo: unknown = null;
  for (const almacen of ALMACENES) {
    let respuesta: Response;
    try {
      respuesta = await fetchFn(`https://tienda.mercadona.es/api/products/${id}/?wh=${almacen}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; ComePaya/0.1)" },
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      fallo = error;
      continue;
    }
    if (respuesta.status === 404) continue;
    if (!respuesta.ok) {
      fallo = new Error(`Mercadona respondió ${respuesta.status}`);
      continue;
    }
    return normalizarDetalleMercadona((await respuesta.json()) as DetalleMercadona);
  }
  if (fallo) throw fallo;
  return null;
}

/** Los productos Hacendado (8480000 + id de Mercadona + control) llevan su id dentro: 8480000336408 → 33640. */
export function idMercadonaDesdeEan(ean: string): string | null {
  const m = /^8480000(\d{5})\d$/.exec(ean);
  return m ? String(Number(m[1])) : null;
}

/**
 * Producto de Mercadona con ese código de barras, para cuando Open Food Facts no lo tiene.
 * Mercadona no permite buscar por código: se prueba el id que lleva dentro y la lista de códigos conocidos,
 * y solo se acepta si la ficha tiene exactamente ese código.
 */
export async function buscarEnMercadonaPorEan(ean: string, fetchFn: typeof fetch = fetch): Promise<(ResultadoMercadona & { ean: string | null }) | null> {
  const candidatos = [...new Set([idMercadonaDesdeEan(ean), CODIGOS_CONOCIDOS[ean]].filter((id): id is string => Boolean(id)))];
  for (const id of candidatos) {
    const producto = await obtenerProductoMercadona(id, fetchFn).catch(() => null);
    if (producto?.ean === ean) return producto;
  }
  return null;
}

/** Ficha de Mercadona en el formato común de producto externo (sin datos de salud: Mercadona no los da en números). */
export function aProductoExterno(producto: ResultadoMercadona, ean: string): ProductoExterno {
  return {
    ean,
    nombre: producto.nombre,
    marca: producto.marca,
    cantidad_texto: producto.envase_texto,
    cantidad_envase: producto.cantidad_envase,
    unidad_envase: producto.unidad_envase,
    foto_url: producto.foto_url,
    nutrientes_100: null,
    nutriscore: null,
    nova: null,
    niveles_nutrientes: null,
    aditivos: [],
    alergenos: [],
    completitud_datos: 0.3,
    fuente: "mercadona",
  };
}

export function normalizarDetalleMercadona(d: DetalleMercadona): ResultadoMercadona & { ean: string | null } {
  return {
    ...normalizarHitMercadona({ ...d, thumbnail: d.photos?.[0]?.regular ?? d.thumbnail }),
    ean: d.ean && /^\d{8,14}$/.test(d.ean) ? d.ean : null,
  };
}

/** 0,4 kg → 400 g; 1 l → 1000 ml; 250 g → 250 g. Otros formatos (ud, docenas) no se convierten. */
function envase(tamano: number | null | undefined, formato: string | null | undefined): { cantidad: number | null; unidad: "g" | "ml" | null } {
  if (!tamano || tamano <= 0 || !formato) return { cantidad: null, unidad: null };
  const f = formato.toLowerCase();
  const redondo = (n: number) => Math.round(n * 1000) / 1000;
  if (f === "kg") return { cantidad: redondo(tamano * 1000), unidad: "g" };
  if (f === "g") return { cantidad: redondo(tamano), unidad: "g" };
  if (f === "l") return { cantidad: redondo(tamano * 1000), unidad: "ml" };
  if (f === "ml") return { cantidad: redondo(tamano), unidad: "ml" };
  if (f === "cl") return { cantidad: redondo(tamano * 10), unidad: "ml" };
  return { cantidad: null, unidad: null };
}
