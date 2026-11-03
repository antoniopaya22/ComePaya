import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "./supabase";

/** Qué consultas cambian cuando cambia cada tabla publicada en Supabase Realtime. */
const AFECTADAS: Record<string, (hogarId: string) => QueryKey[]> = {
  item_lista: (h) => [["lista", h], ["compras", h]],
  lote_despensa: (h) => [["lotes", h], ["productos", h], ["movimientos", h]],
  franja_menu: (h) => [["franjas", h]],
  racion_congelada: (h) => [["raciones", h]],
  receta: (h) => [["recetas", h]],
  ingrediente: (h) => [["ingredientes", h], ["productos", h]],
  producto: (h) => [["productos", h], ["lotes", h]],
  tienda: (h) => [["tiendas", h]],
  regla_semanal: (h) => [["reglas", h]],
  rechazo_sugerencia: (h) => [["rechazos", h]],
  // Comensales, bebé, alérgenos del hogar y quién es miembro: van en la consulta de hogares del usuario.
  miembro: (h) => [["miembros", h], ["hogares"]],
  hogar: () => [["hogares"]],
};

/** La tabla hogar no tiene hogar_id: se filtra por su id. */
const COLUMNA_HOGAR: Record<string, string> = { hogar: "id" };

/** Tras este tiempo en segundo plano se vuelve a consultar todo: el móvil puede haber cortado la conexión en tiempo real. */
const AUSENCIA_LARGA_MS = 60_000;

/**
 * Mantiene al día los datos del hogar mientras la app está abierta, en cualquier pantalla:
 * cuando otro miembro cambia algo, se refrescan las consultas afectadas (también los contadores
 * de la barra lateral). Gracias a esto la caché puede considerarse fresca durante minutos.
 * Los borrados no admiten filtro por columna en Realtime, así que se escuchan sin filtrar:
 * solo llevan la clave primaria y basta con volver a consultar.
 */
export function useSincronizacionHogar(hogarId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refrescarTodo = () =>
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && (q.queryKey[1] === hogarId || q.queryKey[0] === "hogares") });
    // Nombre único por montaje: si se reutilizara uno que aún se está cerrando, se quedaría sin eventos.
    let canal = supabase.channel(`hogar:${hogarId}:${crypto.randomUUID()}`);
    for (const [tabla, claves] of Object.entries(AFECTADAS)) {
      const filtro = `${COLUMNA_HOGAR[tabla] ?? "hogar_id"}=eq.${hogarId}`;
      const refrescar = () => claves(hogarId).forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      canal = canal
        .on("postgres_changes", { event: "INSERT", schema: "public", table: tabla, filter: filtro }, refrescar)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: tabla, filter: filtro }, refrescar)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: tabla }, refrescar);
    }
    let conectadoAntes = false;
    canal.subscribe((estado) => {
      if (estado !== "SUBSCRIBED") return;
      // Al reconectar, lo que pasó mientras tanto no llega como evento: se pide de nuevo.
      if (conectadoAntes) refrescarTodo();
      conectadoAntes = true;
    });

    let ocultaDesde = 0;
    function alCambiarVisibilidad() {
      if (document.hidden) ocultaDesde = Date.now();
      else if (ocultaDesde && Date.now() - ocultaDesde > AUSENCIA_LARGA_MS) refrescarTodo();
    }
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      supabase.removeChannel(canal);
    };
  }, [hogarId, queryClient]);
}
