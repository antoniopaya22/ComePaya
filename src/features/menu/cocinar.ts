import { planDescuento } from "@/dominio/despensa";
import { escalar } from "@/dominio/menu";
import { formatearCantidad } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { Ingrediente, LoteConProducto, RecetaCompleta } from "@/lib/tipos";

/**
 * Descuenta de la despensa lo que gasta una receta al cocinarla (§3.5), lote a lote empezando por lo que antes caduca.
 * Los opcionales y los básicos "siempre disponibles" no se descuentan. Devuelve lo que faltaba, legible.
 */
export async function descontarReceta(datos: {
  hogarId: string;
  receta: RecetaCompleta;
  raciones: number;
  lotes: LoteConProducto[];
  ingredientes: Ingrediente[];
}): Promise<string[]> {
  const basicos = new Set(datos.ingredientes.filter((i) => i.siempre_disponible).map((i) => i.id));
  const faltaba: string[] = [];

  for (const ri of datos.receta.ingredientes) {
    if (ri.opcional || basicos.has(ri.ingrediente_id)) continue;
    const cantidad = escalar(ri.cantidad, datos.receta.raciones, datos.raciones);
    const lotes = datos.lotes.filter((l) => l.producto.ingrediente_id === ri.ingrediente_id);
    const plan = planDescuento(lotes, cantidad);

    for (const cambio of plan.lotes) {
      const lote = lotes.find((l) => l.id === cambio.id)!;
      const { error } =
        cambio.restante > 0
          ? await supabase.from("lote_despensa").update({ cantidad: cambio.restante }).eq("id", cambio.id)
          : await supabase.from("lote_despensa").delete().eq("id", cambio.id);
      if (error) throw error;
      await supabase.from("movimiento_despensa").insert({
        hogar_id: datos.hogarId,
        producto_id: lote.producto_id,
        cantidad: -cambio.consumido,
        tipo: "consumo",
        motivo: `Cocinado: ${datos.receta.nombre}`,
      });
    }
    if (plan.sinCubrir > 0) {
      faltaba.push(`${formatearCantidad(Math.round(plan.sinCubrir * 10) / 10, ri.ingrediente.unidad_base)} de ${ri.ingrediente.nombre.toLowerCase()}`);
    }
  }
  return faltaba;
}
