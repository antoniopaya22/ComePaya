import { convertir, factorFusion } from "@/dominio/fusion";
import type { UnidadBase } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { Ingrediente } from "@/lib/tipos";

function comprobar<T extends { error: unknown }>(r: T): T {
  if (r.error) throw r.error;
  return r;
}

/**
 * Pasa recetas, productos (con sus lotes) y lista de `origenId` a `destinoId`, multiplicando las cantidades por `factor`.
 * Con el mismo id solo convierte (cambio de unidad). Por pasos y no en una transacción, para no necesitar otra migración.
 */
async function pasarReferencias(origenId: string, destinoId: string, factor: number): Promise<void> {
  const { data: lineas } = comprobar(await supabase.from("receta_ingrediente").select("id, cantidad").eq("ingrediente_id", origenId));
  for (const l of (lineas ?? []) as { id: string; cantidad: number }[]) {
    comprobar(
      await supabase
        .from("receta_ingrediente")
        .update({ ingrediente_id: destinoId, cantidad: convertir(l.cantidad, factor) })
        .eq("id", l.id),
    );
  }

  const { data: productos } = comprobar(await supabase.from("producto").select("id, cantidad_envase").eq("ingrediente_id", origenId));
  for (const p of (productos ?? []) as { id: string; cantidad_envase: number | null }[]) {
    if (factor !== 1) {
      // Los lotes van en la unidad del ingrediente: se convierten con él.
      const { data: lotes } = comprobar(await supabase.from("lote_despensa").select("id, cantidad").eq("producto_id", p.id));
      for (const l of (lotes ?? []) as { id: string; cantidad: number }[]) {
        comprobar(
          await supabase
            .from("lote_despensa")
            .update({ cantidad: convertir(l.cantidad, factor) })
            .eq("id", l.id),
        );
      }
    }
    comprobar(
      await supabase
        .from("producto")
        .update({
          ingrediente_id: destinoId,
          cantidad_envase: p.cantidad_envase && factor !== 1 ? convertir(p.cantidad_envase, factor) : p.cantidad_envase,
        })
        .eq("id", p.id),
    );
  }

  const { data: items } = comprobar(await supabase.from("item_lista").select("id, cantidad_base").eq("ingrediente_id", origenId));
  for (const i of (items ?? []) as { id: string; cantidad_base: number | null }[]) {
    comprobar(
      await supabase
        .from("item_lista")
        .update({ ingrediente_id: destinoId, cantidad_base: i.cantidad_base ? convertir(i.cantidad_base, factor) : null })
        .eq("id", i.id),
    );
  }
}

/** Une `origen` en `destino`: todo lo suyo pasa al destino, con las cantidades convertidas por `factor`, y el origen se borra. */
export async function fusionarIngredientes(
  origen: Pick<Ingrediente, "id" | "siempre_disponible" | "bebe_introducido">,
  destino: Pick<Ingrediente, "id" | "siempre_disponible" | "bebe_introducido">,
  factor: number,
): Promise<void> {
  await pasarReferencias(origen.id, destino.id, factor);

  // Si el origen era básico o el bebé ya lo había probado, el destino lo hereda.
  const heredado = {
    ...(origen.siempre_disponible && !destino.siempre_disponible ? { siempre_disponible: true } : {}),
    ...(origen.bebe_introducido && (!destino.bebe_introducido || origen.bebe_introducido < destino.bebe_introducido)
      ? { bebe_introducido: origen.bebe_introducido }
      : {}),
  };
  if (Object.keys(heredado).length) comprobar(await supabase.from("ingrediente").update(heredado).eq("id", destino.id));
  comprobar(await supabase.from("ingrediente").delete().eq("id", origen.id));
}

/**
 * Cambia la unidad de un ingrediente que ya se usa (patatas en gramos → por unidades) y convierte sus recetas,
 * despensa, lista, stock mínimo y medidas caseras. `pesoUnidad`: g o ml de una unidad, si se pasa a o desde unidades.
 */
export async function cambiarUnidad(
  ingrediente: Pick<Ingrediente, "id" | "unidad_base" | "peso_unidad_g" | "stock_minimo" | "equivalencias">,
  nueva: UnidadBase,
  pesoUnidad: number | null,
): Promise<void> {
  const factor = factorFusion(ingrediente.unidad_base, nueva, pesoUnidad);
  if (factor === null) throw new Error("Falta cuánto pesa una unidad");
  if (nueva === ingrediente.unidad_base) return;
  await pasarReferencias(ingrediente.id, ingrediente.id, factor);
  comprobar(
    await supabase
      .from("ingrediente")
      .update({
        unidad_base: nueva,
        peso_unidad_g: nueva === "ud" ? pesoUnidad : null,
        stock_minimo: ingrediente.stock_minimo ? convertir(ingrediente.stock_minimo, factor) : null,
        equivalencias: ingrediente.equivalencias
          ? Object.fromEntries(Object.entries(ingrediente.equivalencias).map(([k, v]) => [k, convertir(v, factor)]))
          : null,
      })
      .eq("id", ingrediente.id),
  );
}
