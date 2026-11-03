import { factorFusion } from "@/dominio/fusion";
import type { UnidadBase } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { Ingrediente } from "@/lib/tipos";

/**
 * Une `origen` en `destino`: recetas, productos (con sus lotes) y lista pasan al destino con las cantidades
 * convertidas por `factor`, y el origen se borra. Todo en una transacción (función SQL `unir_ingredientes`).
 */
export async function fusionarIngredientes(origen: Pick<Ingrediente, "id">, destino: Pick<Ingrediente, "id">, factor: number): Promise<void> {
  const { error } = await supabase.rpc("unir_ingredientes", { p_origen: origen.id, p_destino: destino.id, p_factor: factor });
  if (error) throw error;
}

/**
 * Cambia la unidad de un ingrediente que ya se usa (patatas en gramos → por unidades) y convierte sus recetas,
 * despensa, lista, stock mínimo y medidas caseras, en una transacción (función SQL `cambiar_unidad_ingrediente`).
 * `pesoUnidad`: g o ml de una unidad, si se pasa a o desde unidades.
 */
export async function cambiarUnidad(ingrediente: Pick<Ingrediente, "id" | "unidad_base">, nueva: UnidadBase, pesoUnidad: number | null): Promise<void> {
  const factor = factorFusion(ingrediente.unidad_base, nueva, pesoUnidad);
  if (factor === null) throw new Error("Falta cuánto pesa una unidad");
  if (nueva === ingrediente.unidad_base) return;
  const { error } = await supabase.rpc("cambiar_unidad_ingrediente", {
    p_ingrediente: ingrediente.id,
    p_unidad: nueva,
    p_factor: factor,
    p_peso_unidad: nueva === "ud" ? pesoUnidad : null,
  });
  if (error) throw error;
}
