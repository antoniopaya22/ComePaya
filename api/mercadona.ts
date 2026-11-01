import { EAN_VALIDO, type ProductoExterno } from "../src/dominio/producto-externo";
import { guardarCatalogo } from "./_lib/catalogo";
import { buscarEnMercadona, type ResultadoMercadona } from "./_lib/mercadona";
import { json, tokenDe, usuarioDeToken } from "./_lib/supabase-servidor";

/** GET /api/mercadona?q=tomate triturado → ResultadoMercadona[] (vacío si Mercadona falla: es un complemento). */
export async function GET(request: Request): Promise<Response> {
  const texto = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (texto.length < 2) return json([]);
  try {
    return json(await buscarEnMercadona(texto), 200, "public, s-maxage=86400");
  } catch (error) {
    console.error("Fallo buscando en Mercadona", texto, error);
    return json([], 200);
  }
}

/**
 * POST /api/mercadona { ean, producto: ResultadoMercadona }
 * Guarda en la caché compartida que ese código de barras es ese producto de Mercadona,
 * para que el siguiente hogar que lo escanee lo encuentre directamente. Requiere sesión.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await usuarioDeToken(tokenDe(request)))) return json({ error: "Sin sesión" }, 401);
  const { ean, producto } = (await request.json().catch(() => ({}))) as { ean?: string; producto?: ResultadoMercadona };
  if (!ean || !EAN_VALIDO.test(ean) || !producto?.mercadona_id || !producto.nombre) return json({ error: "Datos no válidos" }, 400);

  const externo: ProductoExterno = {
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
    completitud_datos: 0.3,
    fuente: "mercadona",
  };
  await guardarCatalogo(externo, producto.mercadona_id);
  return json({ ok: true });
}
