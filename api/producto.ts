import { EAN_VALIDO } from "../src/dominio/producto-externo";
import { guardarCatalogo, leerCatalogo } from "./_lib/catalogo";
import { buscarEnOpenFoodFacts } from "./_lib/openfoodfacts";
import { json } from "./_lib/supabase-servidor";

/**
 * GET /api/producto?ean=8410188012092
 * Orden (§6): caché compartida (catalogo_ean) → Open Food Facts. Mercadona no permite buscar por EAN:
 * se ofrece en el alta manual buscando por nombre (/api/mercadona).
 * 200 → ProductoExterno · 404 → no encontrado · 400 → EAN no válido · 502 → la fuente externa ha fallado.
 */
export async function GET(request: Request): Promise<Response> {
  const ean = new URL(request.url).searchParams.get("ean")?.trim() ?? "";
  if (!EAN_VALIDO.test(ean)) return json({ error: "EAN no válido" }, 400);

  const enCache = await leerCatalogo(ean);
  if (enCache) return json(enCache, 200, "public, s-maxage=86400");

  try {
    const producto = await buscarEnOpenFoodFacts(ean);
    if (!producto) return json({ error: "Producto no encontrado" }, 404, "public, s-maxage=3600");
    await guardarCatalogo(producto);
    return json(producto, 200, "public, s-maxage=86400, stale-while-revalidate=604800");
  } catch (error) {
    console.error("Fallo consultando Open Food Facts", ean, error);
    return json({ error: "Open Food Facts no responde" }, 502);
  }
}
