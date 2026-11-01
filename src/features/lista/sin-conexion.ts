import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ItemLista } from "@/lib/tipos";

// Lista de la compra sin conexión (§4.2): marcar y añadir se guardan como mutaciones en pausa
// y se envían al volver la red, aunque se haya cerrado la app entre medias. Para eso las funciones
// de mutación se registran aquí por clave (las mutaciones guardadas no conservan funciones).

export const CLAVE_ALTERNAR = ["lista", "alternar"] as const;
export const CLAVE_ANADIR = ["lista", "anadir"] as const;
/** Mismo ámbito para todas: se envían en orden (añadir antes que marcar), también al recuperar la red. */
export const AMBITO_LISTA = { id: "lista" };

export type FilaNueva = Pick<ItemLista, "id" | "hogar_id" | "texto" | "cantidad" | "ingrediente_id" | "seccion_super" | "creado_en">;

export function registrarMutacionesLista(queryClient: QueryClient) {
  queryClient.setMutationDefaults(CLAVE_ALTERNAR, {
    scope: AMBITO_LISTA,
    mutationFn: async ({ id, marcado }: { id: string; marcado: boolean }) => {
      const { error } = await supabase.from("item_lista").update({ marcado }).eq("id", id);
      if (error) throw error;
    },
  });
  queryClient.setMutationDefaults(CLAVE_ANADIR, {
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
