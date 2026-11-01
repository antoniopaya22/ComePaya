// API no oficial de Mercadona (§6): aislada aquí, con tiempos de espera cortos y sin romper nada si falla.
// La búsqueda usa el Algolia público de la tienda online (credenciales de solo lectura que publica su web).

const ALGOLIA_APP = process.env.MERCADONA_ALGOLIA_APP ?? "7UZJKL1DJ0";
const ALGOLIA_CLAVE = process.env.MERCADONA_ALGOLIA_CLAVE ?? "9d8f2e39e90df472b4f2e559a116fe17";
// El surtido y los precios dependen del almacén (vlc1, mad1, bcn1…).
const ALMACEN = process.env.MERCADONA_ALMACEN ?? "vlc1";

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

export async function buscarEnMercadona(texto: string, fetchFn: typeof fetch = fetch): Promise<ResultadoMercadona[]> {
  const respuesta = await fetchFn(`https://${ALGOLIA_APP.toLowerCase()}-dsn.algolia.net/1/indexes/products_prod_${ALMACEN}_es/query`, {
    method: "POST",
    headers: { "x-algolia-application-id": ALGOLIA_APP, "x-algolia-api-key": ALGOLIA_CLAVE, "Content-Type": "application/json" },
    body: JSON.stringify({ query: texto, hitsPerPage: 8 }),
    signal: AbortSignal.timeout(5000),
  });
  if (!respuesta.ok) throw new Error(`Mercadona respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as { hits?: HitMercadona[] };
  return (datos.hits ?? []).map(normalizarHitMercadona);
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

/** Ficha de un producto de Mercadona por su id, con su código de barras. Null si no existe. */
export async function obtenerProductoMercadona(id: string, fetchFn: typeof fetch = fetch): Promise<(ResultadoMercadona & { ean: string | null }) | null> {
  if (!/^\d+(\.\d+)?$/.test(id)) return null;
  const respuesta = await fetchFn(`https://tienda.mercadona.es/api/products/${id}/`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; Despensa/0.1)" },
    signal: AbortSignal.timeout(5000),
  });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`Mercadona respondió ${respuesta.status}`);
  return normalizarDetalleMercadona((await respuesta.json()) as DetalleMercadona);
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
