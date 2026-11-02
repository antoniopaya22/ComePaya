import { EAN_VALIDO, type ProductoExterno } from "../src/dominio/producto-externo.js";
import { guardarCatalogo, leerCatalogo } from "./_lib/catalogo.js";
import { aProductoExterno, buscarEnMercadonaPorEan } from "./_lib/mercadona.js";
import { buscarEnOpenFoodFacts } from "./_lib/openfoodfacts.js";
import { json, servidorConfigurado, tokenDe, usuarioDeToken } from "./_lib/supabase-servidor.js";

/**
 * GET /api/producto?ean=8410188012092
 * Orden (§6): caché compartida (catalogo_ean) → Open Food Facts → Mercadona, por el id que llevan dentro los
 * códigos Hacendado o por la lista de códigos conocidos (Mercadona no permite buscar por código).
 * 200 → ProductoExterno · 404 → no encontrado · 400 → EAN no válido · 502 → la fuente externa ha fallado.
 */
export async function GET(request: Request): Promise<Response> {
  if (servidorConfigurado && !(await usuarioDeToken(tokenDe(request)))) return json({ error: "Sin sesión" }, 401);
  const ean = new URL(request.url).searchParams.get("ean")?.trim() ?? "";
  if (!EAN_VALIDO.test(ean)) return json({ error: "EAN no válido" }, 400);

  const enCache = await leerCatalogo(ean);
  if (enCache) return json(enCache, 200, "private, max-age=86400");

  let producto: ProductoExterno | null = null;
  let fallo: unknown = null;
  try {
    producto = await buscarEnOpenFoodFacts(ean);
  } catch (error) {
    fallo = error;
    console.error("Fallo consultando Open Food Facts", ean, error);
  }
  if (producto) {
    await guardarCatalogo(producto);
    return json(producto, 200, "private, max-age=86400");
  }

  // Si Open Food Facts no lo tiene (o no responde), se prueba en Mercadona.
  const mercadona = await buscarEnMercadonaPorEan(ean).catch(() => null);
  if (mercadona) {
    const externo = aProductoExterno(mercadona, ean);
    await guardarCatalogo(externo, mercadona.mercadona_id, { sobrescribir: false });
    return json(externo, 200, "private, max-age=86400");
  }
  if (fallo) return json({ error: "Open Food Facts no responde" }, 502);
  return json({ error: "Producto no encontrado" }, 404, "private, max-age=3600");
}
