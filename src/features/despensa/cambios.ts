import type { FechaISO } from "@/dominio/caducidad";
import { supabase } from "@/lib/supabase";
import type { Ubicacion } from "@/lib/tipos";

/** Cambios de despensa que se aplican juntos en una transacción (función SQL aplicar_cambios_despensa). */
export interface CambiosDespensa {
  lotes_crear?: { producto_id: string; cantidad: number; ubicacion: Ubicacion; fecha_caducidad: FechaISO | null; abierto_en?: FechaISO | null }[];
  lotes_actualizar?: { id: string; cantidad?: number; ubicacion?: Ubicacion; fecha_caducidad?: FechaISO | null; abierto_en?: FechaISO | null }[];
  /** Suma o resta sobre lo que haya en ese momento (si queda en 0 o menos, el lote se borra). */
  lotes_delta?: { id: string; delta: number }[];
  lotes_borrar?: string[];
  movimientos?: { producto_id: string; cantidad: number; tipo: "alta" | "consumo" | "tirado" | "ajuste"; motivo?: string | null }[];
  items_borrar?: string[];
  franja_cocinada?: string | null;
  racion_congelada?: { receta_id: string | null; descripcion: string; raciones: number };
  /** Suma o resta raciones congeladas sobre lo que haya; en 0 o menos, la ración se quita. */
  raciones_delta?: { id: string; delta: number }[];
}

/** Todo o nada: si algo falla, la despensa queda como estaba. */
export async function aplicarCambiosDespensa(hogarId: string, cambios: CambiosDespensa): Promise<void> {
  const { error } = await supabase.rpc("aplicar_cambios_despensa", { p_hogar_id: hogarId, p_cambios: cambios });
  if (error) throw error;
}
