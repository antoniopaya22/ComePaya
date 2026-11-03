import { planDescuento } from "@/dominio/despensa";
import { escalar } from "@/dominio/menu";
import { formatearCantidad, type UnidadBase } from "@/dominio/unidades";
import type { Ingrediente, LoteConProducto, RecetaCompleta } from "@/lib/tipos";
import type { CambiosDespensa } from "../despensa/cambios";
import { aplicarConDeshacer, type Instantanea } from "../despensa/deshacer";

/**
 * Marca una franja como cocinada y, si se pide, descuenta de la despensa lo que gasta la receta (§3.5),
 * lote a lote empezando por lo que antes caduca, y guarda las raciones congeladas. Todo en una transacción.
 * Los opcionales y los básicos "siempre disponibles" no se descuentan. Devuelve lo que faltaba, legible, y cómo deshacerlo.
 */
export async function cocinarFranja(datos: {
  hogarId: string;
  franjaId: string;
  receta: RecetaCompleta;
  raciones: number;
  descontar: boolean;
  congelar: number;
  /** Lotes recién consultados (no de la caché), para no restar sobre cantidades viejas. */
  lotes: LoteConProducto[];
  ingredientes: Ingrediente[];
}): Promise<{ faltaba: string[]; antes: Instantanea }> {
  const cambios: CambiosDespensa = { franja_cocinada: datos.franjaId, lotes_delta: [], movimientos: [] };
  const faltaba: string[] = [];

  if (datos.descontar) {
    const basicos = new Set(datos.ingredientes.filter((i) => i.siempre_disponible).map((i) => i.id));
    // Un ingrediente puede aparecer en varias líneas (tomate para la salsa y para la ensalada): se suma.
    const necesidades = new Map<string, { cantidad: number; nombre: string; unidad: UnidadBase }>();
    for (const ri of datos.receta.ingredientes) {
      if (ri.opcional || basicos.has(ri.ingrediente_id)) continue;
      const previa = necesidades.get(ri.ingrediente_id);
      const cantidad = escalar(ri.cantidad, datos.receta.raciones, datos.raciones);
      necesidades.set(ri.ingrediente_id, { cantidad: (previa?.cantidad ?? 0) + cantidad, nombre: ri.ingrediente.nombre, unidad: ri.ingrediente.unidad_base });
    }

    for (const [ingredienteId, n] of necesidades) {
      const lotes = datos.lotes.filter((l) => l.producto.ingrediente_id === ingredienteId);
      const plan = planDescuento(lotes, n.cantidad);
      for (const c of plan.lotes) {
        const lote = lotes.find((l) => l.id === c.id)!;
        cambios.lotes_delta!.push({ id: c.id, delta: -c.consumido });
        cambios.movimientos!.push({ producto_id: lote.producto_id, cantidad: -c.consumido, tipo: "consumo", motivo: `Cocinado: ${datos.receta.nombre}` });
      }
      if (plan.sinCubrir > 0) faltaba.push(`${formatearCantidad(Math.round(plan.sinCubrir * 10) / 10, n.unidad)} de ${n.nombre.toLowerCase()}`);
    }
  }

  if (datos.congelar > 0) cambios.racion_congelada = { receta_id: datos.receta.id, descripcion: datos.receta.nombre, raciones: datos.congelar };
  const antes = await aplicarConDeshacer(datos.hogarId, cambios, datos.lotes);
  return { faltaba, antes };
}
