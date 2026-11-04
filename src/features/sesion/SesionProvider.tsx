import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { vaciarCache } from "@/lib/cache";
import { supabase } from "@/lib/supabase";
import { desactivarAvisos } from "../ajustes/avisos";

/** undefined mientras se comprueba si hay sesión guardada; null si no hay. */
const SesionContext = createContext<Session | null | undefined>(undefined);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const comprobar = () =>
      supabase.auth.getSession().then(({ data, error }) => {
        if (data.session) return setSesion(data.session);
        // Sin red, un token caducado (dura una hora) no se puede renovar y Supabase no da sesión. Se sigue con la
        // guardada para abrir la app con lo que hay en el móvil (la lista del súper); se renueva sola al volver la red.
        setSesion(error || !navigator.onLine ? sesionGuardada() : null);
      });
    comprobar();
    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      // La sesión inicial ya la decide comprobar(), también cuando no hay red.
      if (evento === "INITIAL_SESSION" && !nueva) return;
      setSesion(nueva);
    });
    window.addEventListener("online", comprobar);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("online", comprobar);
    };
  }, []);

  return <SesionContext.Provider value={sesion}>{children}</SesionContext.Provider>;
}

/** La sesión que Supabase guarda en el móvil (sb-<proyecto>-auth-token), aunque su token haya caducado. */
function sesionGuardada(): Session | null {
  try {
    const clave = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    const guardada = clave ? (JSON.parse(localStorage.getItem(clave) ?? "null") as Session | null) : null;
    return guardada?.access_token && guardada.user ? guardada : null;
  } catch {
    return null;
  }
}

export function useSesion() {
  return useContext(SesionContext);
}

/** Sesión garantizada: solo se usa por debajo de la pantalla de login. */
export function useUsuario() {
  const sesion = useContext(SesionContext);
  if (!sesion) throw new Error("useUsuario requiere una sesión iniciada");
  return sesion.user;
}

export function entrarConGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } },
  });
}

/** Pregunta y, si se confirma, cierra sesión. */
export async function cerrarSesionPreguntando(confirmar: (o: { titulo: string; mensaje: string; aceptar: string; peligro?: boolean }) => Promise<boolean>) {
  if (await confirmar({ titulo: "¿Cerrar sesión?", mensaje: "Tendrás que volver a entrar con tu cuenta en este móvil.", aceptar: "Cerrar sesión", peligro: true })) await cerrarSesion();
}

/** Cierra sesión sin dejar en el dispositivo avisos, datos del hogar ni cambios pendientes de esta cuenta. */
export async function cerrarSesion() {
  await desactivarAvisos().catch(() => {});
  vaciarCache();
  return supabase.auth.signOut();
}
