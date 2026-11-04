import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { planDeshacer, planVacio, productosAfectados, type FotoLote } from "@/dominio/deshacer";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/utils";
import { claves } from "../datos";
import { aplicarCambiosDespensa, type CambiosDespensa } from "./cambios";

const COLUMNAS = "id, producto_id, cantidad, ubicacion, fecha_caducidad, abierto_en";

/** Cómo estaba la despensa antes y justo después de un cambio, para poder volver atrás. */
export interface Instantanea {
  productos: string[];
  lotes: FotoLote[];
  despues: FotoLote[];
  movimientos: NonNullable<CambiosDespensa["movimientos"]>;
  franjaCocinada: string | null;
  racionCongelada: CambiosDespensa["racion_congelada"] | null;
}

/**
 * Aplica `cambios` (en una transacción) y devuelve cómo deshacerlo. `lotes`: los lotes actuales del hogar
 * (de la caché vale: si otro miembro los ha cambiado, deshacer vuelve a lo que veía quien hizo el cambio).
 * Sin `lotes`, se consultan los de los productos afectados.
 */
export async function aplicarConDeshacer(hogarId: string, cambios: CambiosDespensa, lotes?: FotoLote[]): Promise<Instantanea> {
  const productos = productosAfectados(cambios, lotes ?? []);
  const antes = lotes ? lotes.filter((l) => productos.includes(l.producto_id)).map(foto) : await lotesDe(productos);
  const instantanea: Instantanea = {
    productos,
    lotes: antes,
    despues: [],
    movimientos: cambios.movimientos ?? [],
    franjaCocinada: cambios.franja_cocinada ?? null,
    racionCongelada: cambios.racion_congelada ?? null,
  };
  await aplicarCambiosDespensa(hogarId, cambios);
  instantanea.despues = await lotesDe(productos);
  return instantanea;
}

async function lotesDe(productos: string[]): Promise<FotoLote[]> {
  if (!productos.length) return [];
  const { data, error } = await supabase.from("lote_despensa").select(COLUMNAS).in("producto_id", productos);
  if (error) throw error;
  return ((data ?? []) as FotoLote[]).map(foto);
}

/** Deshace lo que hizo el cambio (sin pisar lo que otro móvil haya hecho después) y quita los movimientos que apuntó. */
export async function deshacerDespensa(hogarId: string, antes: Instantanea): Promise<void> {
  const plan = planDeshacer(antes.lotes, antes.despues, await lotesDe(antes.productos));
  if (!planVacio(plan)) await aplicarCambiosDespensa(hogarId, plan);
  // Los movimientos alimentan las estadísticas (lo tirado, lo consumido): se borran para que no cuenten.
  for (const m of antes.movimientos) await borrarUltimo("movimiento_despensa", { producto_id: m.producto_id, tipo: m.tipo, cantidad: m.cantidad });
  if (antes.franjaCocinada) {
    const { error } = await supabase.from("franja_menu").update({ cocinado: false }).eq("id", antes.franjaCocinada);
    if (error) throw error;
  }
  if (antes.racionCongelada) await borrarUltimo("racion_congelada", { hogar_id: hogarId, descripcion: antes.racionCongelada.descripcion });
}

async function borrarUltimo(tabla: "movimiento_despensa" | "racion_congelada", filtro: Record<string, string | number>) {
  const { data, error } = await supabase.from(tabla).select("id").match(filtro).order("creado_en", { ascending: false }).limit(1);
  if (error) throw error;
  if (!data?.length) return;
  const borrado = await supabase.from(tabla).delete().eq("id", data[0].id);
  if (borrado.error) throw borrado.error;
}

function foto(l: FotoLote): FotoLote {
  return {
    id: l.id,
    producto_id: l.producto_id,
    cantidad: Number(l.cantidad),
    ubicacion: l.ubicacion,
    fecha_caducidad: l.fecha_caducidad ?? null,
    abierto_en: l.abierto_en ?? null,
  };
}

/** Aviso de "hecho" con el botón Deshacer. Al deshacer refresca lo que haya cambiado. */
export function avisarConDeshacer(
  queryClient: QueryClient,
  hogarId: string,
  mensaje: string,
  deshacer: () => Promise<void>,
  opciones: { descripcion?: string; tipo?: "success" | "info" } = {},
) {
  (opciones.tipo === "info" ? toast.info : toast.success)(mensaje, {
    description: opciones.descripcion,
    duration: 8000,
    action: {
      label: "Deshacer",
      onClick: async () => {
        try {
          await deshacer();
          toast.success("Deshecho");
        } catch (error) {
          toast.error(`No se ha podido deshacer: ${mensajeError(error)}`);
        } finally {
          for (const clave of [claves.lotes, claves.raciones, claves.franjas, claves.lista, claves.ingredientes]) {
            void queryClient.invalidateQueries({ queryKey: clave(hogarId) });
          }
          void queryClient.invalidateQueries({ queryKey: ["movimientos", hogarId] });
        }
      },
    },
  });
}
