import { extraerRecetaJsonLd } from "../src/dominio/importar";
import { leerUrlPublica, urlPublica } from "./_lib/red";
import { json, servidorConfigurado, tokenDe, usuarioDeToken } from "./_lib/supabase-servidor";

const TAMANO_MAXIMO = 3 * 1024 * 1024;

/**
 * GET /api/importar-receta?url=https://… — lee la receta que la web publica en schema.org/Recipe (JSON-LD).
 * 200 → RecetaWeb · 422 → la página no publica una receta · 400 → URL no válida · 502 → la web no responde.
 */
export async function GET(request: Request): Promise<Response> {
  // En producción solo para usuarios con sesión (evita que se use como proxy abierto).
  if (servidorConfigurado && !(await usuarioDeToken(tokenDe(request)))) return json({ error: "Sin sesión" }, 401);

  const url = await urlPublica(new URL(request.url).searchParams.get("url") ?? "");
  if (!url) return json({ error: "Escribe una dirección web pública y completa (https://…)" }, 400);

  let html: string;
  try {
    const { status, texto } = await leerUrlPublica(url, TAMANO_MAXIMO, {
      "User-Agent": "Mozilla/5.0 (compatible; ComePaya/0.1; importador de recetas)",
      Accept: "text/html",
    });
    // No se reenvía el código exacto de la web para no dar pistas de qué hay detrás.
    if (status >= 400) return json({ error: "La web no ha devuelto la receta" }, 502);
    html = texto;
  } catch (error) {
    return json({ error: error instanceof Error && error.message.includes("dirección") ? error.message : "No se ha podido abrir la web" }, 502);
  }

  const receta = extraerRecetaJsonLd(html);
  if (!receta) return json({ error: "Esta página no publica la receta en un formato que se pueda leer. Cópiala a mano." }, 422);
  return json(receta, 200, "private, max-age=3600");
}
