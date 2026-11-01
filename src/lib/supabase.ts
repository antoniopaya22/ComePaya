import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && clave);

// Sin configuración la app muestra una pantalla de ayuda (App.tsx) y nunca llega a usar el cliente.
export const supabase: SupabaseClient = supabaseConfigurado
  ? createClient(url!, clave!, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : (null as unknown as SupabaseClient);
