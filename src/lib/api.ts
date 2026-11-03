import { supabase } from "./supabase";

/** Llamada a las funciones de servidor (/api) con la sesión del usuario: en producción todas la exigen. */
export async function llamarApi(ruta: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const cabeceras = new Headers(init.headers);
  if (data.session) cabeceras.set("Authorization", `Bearer ${data.session.access_token}`);
  if (init.body && !cabeceras.has("Content-Type")) cabeceras.set("Content-Type", "application/json");
  // Con un tiempo límite: si la fuente externa va lenta, mejor avisar que dejar el escáner esperando.
  return fetch(ruta, { ...init, headers: cabeceras, signal: init.signal ?? AbortSignal.timeout(20_000) });
}
