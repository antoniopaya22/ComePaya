import { stockPorIngrediente } from "@/dominio/compra";
import type { LoteConProducto } from "@/lib/tipos";

/** Stock de la despensa por ingrediente a partir de los lotes cargados. */
export function stockDeLotes(lotes: LoteConProducto[]): Map<string, number> {
  return stockPorIngrediente(lotes.map((l) => ({ ingrediente_id: l.producto.ingrediente_id, cantidad: l.cantidad })));
}
