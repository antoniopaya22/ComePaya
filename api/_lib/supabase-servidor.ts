// Acceso a Supabase desde las funciones de servidor con la clave secreta (salta RLS).
// Es opcional: sin SUPABASE_URL y SUPABASE_SECRET_KEY la app funciona igual, solo sin caché compartida ni avisos.

const URL_SUPABASE = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SECRET_KEY;

export const servidorConfigurado = Boolean(URL_SUPABASE && CLAVE);

/** Petición a la API REST (PostgREST) de Supabase. `ruta` empieza después de /rest/v1/. */
export async function rest<T = unknown>(ruta: string, opciones: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  if (!servidorConfigurado) throw new Error("Supabase no está configurado en el servidor");
  const respuesta = await fetch(`${URL_SUPABASE}/rest/v1/${ruta}`, {
    method: opciones.method ?? "GET",
    headers: {
      apikey: CLAVE!,
      ...(CLAVE!.startsWith("eyJ") ? { Authorization: `Bearer ${CLAVE}` } : {}),
      "Content-Type": "application/json",
      ...(opciones.prefer ? { Prefer: opciones.prefer } : {}),
    },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
    signal: AbortSignal.timeout(8000),
  });
  if (!respuesta.ok) throw new Error(`Supabase respondió ${respuesta.status}: ${await respuesta.text()}`);
  const texto = await respuesta.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Comprueba el token de sesión de un usuario y devuelve su id. */
export async function usuarioDeToken(token: string | null): Promise<string | null> {
  if (!token || !URL_SUPABASE || !CLAVE) return null;
  const respuesta = await fetch(`${URL_SUPABASE}/auth/v1/user`, {
    headers: { apikey: CLAVE, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!respuesta.ok) return null;
  return ((await respuesta.json()) as { id?: string }).id ?? null;
}

export function json(cuerpo: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
  });
}

export function tokenDe(request: Request): string | null {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
}
