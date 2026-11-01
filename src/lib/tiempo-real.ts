import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Refresca una consulta cuando otro miembro del hogar cambia la tabla (Supabase Realtime).
 * Los borrados no admiten filtro por columna en Realtime, así que se escuchan sin filtrar:
 * solo llevan la clave primaria y basta con volver a consultar.
 */
export function useTiempoReal(tabla: string, hogarId: string, queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const clave = JSON.stringify(queryKey);

  useEffect(() => {
    const refrescar = () => queryClient.invalidateQueries({ queryKey: JSON.parse(clave) as QueryKey });
    const filtro = `hogar_id=eq.${hogarId}`;
    const canal = supabase
      // Nombre único por montaje: si se reutilizara uno que aún se está cerrando, se quedaría sin eventos.
      .channel(`${tabla}:${hogarId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: tabla, filter: filtro }, refrescar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: tabla, filter: filtro }, refrescar)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: tabla }, refrescar)
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [tabla, hogarId, clave, queryClient]);
}
