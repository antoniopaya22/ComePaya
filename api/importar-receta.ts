import { extraerRecetaJsonLd } from "../src/dominio/importar";
import { json, servidorConfigurado, tokenDe, usuarioDeToken } from "./_lib/supabase-servidor";

const TAMANO_MAXIMO = 4 * 1024 * 1024;

/**
 * GET /api/importar-receta?url=https://… — lee la receta que la web publica en schema.org/Recipe (JSON-LD).
 * 200 → RecetaWeb · 422 → la página no publica una receta · 400 → URL no válida · 502 → la web no responde.
 */
export async function GET(request: Request): Promise<Response> {
  // En producción solo para usuarios con sesión (evita que se use como proxy abierto).
  if (servidorConfigurado && !(await usuarioDeToken(tokenDe(request)))) return json({ error: "Sin sesión" }, 401);

  const url = urlPermitida(new URL(request.url).searchParams.get("url") ?? "");
  if (!url) return json({ error: "Escribe una dirección web completa (https://…)" }, 400);

  let html: string;
  try {
    const respuesta = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Despensa/0.1; importador de recetas)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) return json({ error: `La web respondió ${respuesta.status}` }, 502);
    if (Number(respuesta.headers.get("content-length") ?? 0) > TAMANO_MAXIMO) return json({ error: "La página es demasiado grande" }, 502);
    html = (await respuesta.text()).slice(0, TAMANO_MAXIMO);
  } catch {
    return json({ error: "No se ha podido abrir la web" }, 502);
  }

  const receta = extraerRecetaJsonLd(html);
  if (!receta) return json({ error: "Esta página no publica la receta en un formato que se pueda leer. Cópiala a mano." }, 422);
  return json(receta, 200, "private, max-age=3600");
}

/** Solo http(s) a dominios públicos: nada de localhost ni redes privadas. */
function urlPermitida(texto: string): URL | null {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  const privado =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("[") ||
    !host.includes(".");
  return privado ? null : url;
}
