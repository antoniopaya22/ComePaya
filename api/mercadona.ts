import { EAN_VALIDO, type ProductoExterno } from "../src/dominio/producto-externo.js";
import { guardarCatalogo } from "./_lib/catalogo.js";
import { buscarEnMercadona, obtenerProductoMercadona } from "./_lib/mercadona.js";
import { json, servidorConfigurado, tokenDe, usuarioDeToken } from "./_lib/supabase-servidor.js";

/** GET /api/mercadona?q=tomate triturado → ResultadoMercadona[] (vacío si Mercadona falla: es un complemento). */
export async function GET(request: Request): Promise<Response> {
  if (servidorConfigurado && !(await usuarioDeToken(tokenDe(request)))) return json({ error: "Sin sesión" }, 401);
  const texto = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (texto.length < 2) return json([]);
  try {
    return json(await buscarEnMercadona(texto), 200, "private, max-age=86400");
  } catch (error) {
    console.error("Fallo buscando en Mercadona", texto, error);
    return json([], 200);
  }
}

/**
 * POST /api/mercadona { ean, mercadona_id }
 * Si ese producto de Mercadona tiene de verdad ese código de barras, lo guarda en la caché compartida
 * para que el siguiente hogar que lo escanee lo encuentre directamente. Los datos los obtiene el servidor
 * (no se fía del cliente) y nunca sobrescribe una ficha que ya exista. Requiere sesión.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await usuarioDeToken(tokenDe(request)))) return json({ error: "Sin sesión" }, 401);
  const { ean, mercadona_id } = (await request.json().catch(() => ({}))) as { ean?: string; mercadona_id?: string };
  if (!ean || !EAN_VALIDO.test(ean) || !mercadona_id) return json({ error: "Datos no válidos" }, 400);

  const producto = await obtenerProductoMercadona(String(mercadona_id)).catch(() => null);
  if (!producto || producto.ean !== ean) return json({ guardado: false, motivo: "El código no coincide con el de Mercadona" });

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
    alergenos: [],
    completitud_datos: 0.3,
    fuente: "mercadona",
  };
  await guardarCatalogo(externo, producto.mercadona_id, { sobrescribir: false });
  return json({ guardado: true });
}
