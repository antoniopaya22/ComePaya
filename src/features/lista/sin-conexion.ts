import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ItemLista } from "@/lib/tipos";
import { esErrorDeRed } from "@/lib/utils";

// Lista de la compra sin conexión (§4.2): marcar y añadir se guardan como mutaciones en pausa
// y se envían al volver la red, aunque se haya cerrado la app entre medias. Para eso las funciones
// de mutación se registran aquí por clave (las mutaciones guardadas no conservan funciones).

export const CLAVE_ALTERNAR = ["lista", "alternar"] as const;
export const CLAVE_ANADIR = ["lista", "anadir"] as const;
/** Mismo ámbito para todas: se envían en orden (añadir antes que marcar), también al recuperar la red. */
export const AMBITO_LISTA = { id: "lista" };

export type FilaNueva = Pick<ItemLista, "id" | "hogar_id" | "texto" | "cantidad" | "cantidad_base" | "ingrediente_id" | "seccion_super" | "creado_en">;

/**
 * Con mala cobertura el móvil cree que hay red y el envío falla o se queda colgado (lo corta el tiempo límite de
 * src/lib/supabase.ts). Se reintenta con espera creciente; si mientras tanto se va la red, queda en pausa y guardado.
 */
const REINTENTOS = {
  retry: (veces: number, error: unknown) => veces < 5 && esErrorDeRed(error),
  retryDelay: (veces: number) => Math.min(30_000, 1000 * 2 ** veces),
};

export function registrarMutacionesLista(queryClient: QueryClient) {
  queryClient.setMutationDefaults(CLAVE_ALTERNAR, {
    ...REINTENTOS,
    scope: AMBITO_LISTA,
    mutationFn: async ({ id, marcado }: { id: string; marcado: boolean }) => {
      const { error } = await supabase.from("item_lista").update({ marcado }).eq("id", id);
      if (error) throw error;
    },
  });
  queryClient.setMutationDefaults(CLAVE_ANADIR, {
    ...REINTENTOS,
    scope: AMBITO_LISTA,
    mutationFn: async (fila: FilaNueva) => {
      // upsert: si se reintenta tras un corte, no se duplica (el id lo genera el móvil).
      const { error } = await supabase.from("item_lista").upsert(fila, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },
  });
}

export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  useEffect(() => {
    const cambiar = () => setEnLinea(navigator.onLine);
    window.addEventListener("online", cambiar);
    window.addEventListener("offline", cambiar);
    return () => {
      window.removeEventListener("online", cambiar);
      window.removeEventListener("offline", cambiar);
    };
  }, []);
  return enLinea;
}
