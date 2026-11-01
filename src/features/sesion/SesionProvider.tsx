import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

/** undefined mientras se comprueba si hay sesión guardada; null si no hay. */
const SesionContext = createContext<Session | null | undefined>(undefined);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  return <SesionContext.Provider value={sesion}>{children}</SesionContext.Provider>;
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

export function cerrarSesion() {
  return supabase.auth.signOut();
}
