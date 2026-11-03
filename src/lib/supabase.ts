import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && clave);

/** Modo demo: Supabase simulada (demo/servidor.ts) y sesión ficticia, sin cuentas reales. */
export const modoDemo = import.meta.env.VITE_DEMO === "1";

if (modoDemo && url) {
  // Sesión ficticia para entrar sin Google. El servidor de la demo acepta cualquier token.
  const claveSesion = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const caduca = Math.floor(Date.now() / 1000) + 365 * 86400;
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const usuario = {
    id: "22222222-2222-4222-8222-222222222222",
    aud: "authenticated",
    role: "authenticated",
    email: "demo@despensa.test",
    user_metadata: { full_name: "Persona de prueba" },
    app_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: usuario.id, exp: caduca, role: "authenticated", aud: "authenticated" })}.demo`;
  try {
    localStorage.setItem(claveSesion, JSON.stringify({ access_token: token, token_type: "bearer", expires_in: 365 * 86400, expires_at: caduca, refresh_token: "demo", user: usuario }));
  } catch {
    // Sin almacenamiento local la demo pedirá iniciar sesión.
  }
}

/**
 * Ninguna petición se queda colgada: con mala cobertura falla a los 15 s (60 s si sube una foto) y la app puede
 * reintentarla o avisar, en vez de dejar el spinner para siempre.
 */
function fetchConTiempoLimite(entrada: RequestInfo | URL, opciones?: RequestInit): Promise<Response> {
  const ruta = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const limite = AbortSignal.timeout(ruta.includes("/storage/") ? 60_000 : 15_000);
  const senal = opciones?.signal ? (AbortSignal.any ? AbortSignal.any([opciones.signal, limite]) : opciones.signal) : limite;
  return fetch(entrada, { ...opciones, signal: senal });
}

// Sin configuración la app muestra una pantalla de ayuda (App.tsx) y nunca llega a usar el cliente.
export const supabase: SupabaseClient = supabaseConfigurado
  ? createClient(url!, clave!, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: !modoDemo, detectSessionInUrl: true },
      realtime: modoDemo ? { params: { eventsPerSecond: 1 } } : undefined,
      global: { fetch: fetchConTiempoLimite },
    })
  : (null as unknown as SupabaseClient);
