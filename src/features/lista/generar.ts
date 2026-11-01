import { hoyISO, sumarDias } from "@/dominio/caducidad";
import { calcularFaltantes, sincronizarAutomaticos, type OrigenAutomatico } from "@/dominio/compra";
import { necesidadesDelMenu, type RecetaPlan } from "@/dominio/menu";
import { formatearCantidad } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { Ingrediente, ItemLista, LoteConProducto, RecetaCompleta } from "@/lib/tipos";
import { consultarFranjas } from "../datos";
import { stockDeLotes } from "../despensa/stock";

export interface ResultadoGeneracion {
  anadidos: number;
  actualizados: number;
  quitados: number;
}

/**
 * Regenera los elementos automáticos de la lista (§3.2–3.3): lo que pide el menú de los próximos `dias`
 * menos lo que hay en la despensa, más lo necesario para el stock mínimo.
 */
export async function generarListaDesdeMenu(datos: {
  hogarId: string;
  dias: number;
  ingredientes: Ingrediente[];
  recetas: RecetaCompleta[];
  lotes: LoteConProducto[];
}): Promise<ResultadoGeneracion> {
  const { hogarId, ingredientes } = datos;
  // La lista se lee aquí, recién consultada: con la de la caché, dos toques seguidos (o dos miembros) duplicarían.
  const { data: filasLista, error: errorLista } = await supabase.from("item_lista").select("*").eq("hogar_id", hogarId);
  if (errorLista) throw errorLista;
  const items = (filasLista ?? []) as ItemLista[];
  const hoy = hoyISO();
  const franjas = await consultarFranjas(hogarId, hoy, sumarDias(hoy, datos.dias - 1));
  const recetas = new Map<string, RecetaPlan>(datos.recetas.map((r) => [r.id, r]));
  const necesidades = necesidadesDelMenu(franjas, recetas, hoy);

  const automaticos = items.filter((i) => i.origen !== "manual" && i.ingrediente_id);
  const yaComprado = new Map<string, number>();
  for (const i of automaticos) {
    if (i.marcado && i.cantidad_base) yaComprado.set(i.ingrediente_id!, (yaComprado.get(i.ingrediente_id!) ?? 0) + i.cantidad_base);
  }
  const apuntadosAMano = new Set(items.filter((i) => i.origen === "manual" && !i.marcado && i.ingrediente_id).map((i) => i.ingrediente_id!));

  const faltantes = calcularFaltantes(necesidades, stockDeLotes(datos.lotes), ingredientes, yaComprado);
  const cambios = sincronizarAutomaticos(
    automaticos
      .filter((i) => !i.marcado)
      .map((i) => ({ id: i.id, ingrediente_id: i.ingrediente_id!, cantidad_base: i.cantidad_base, origen: i.origen as OrigenAutomatico })),
    faltantes,
    apuntadosAMano,
  );

  const porId = new Map(ingredientes.map((i) => [i.id, i]));
  const texto = (ingredienteId: string, cantidad: number) => formatearCantidad(cantidad, porId.get(ingredienteId)?.unidad_base ?? "ud");

  if (cambios.crear.length) {
    const { error } = await supabase.from("item_lista").insert(
      cambios.crear.map((f) => ({
        hogar_id: hogarId,
        texto: porId.get(f.ingrediente_id)!.nombre,
        cantidad: texto(f.ingrediente_id, f.cantidad),
        cantidad_base: f.cantidad,
        ingrediente_id: f.ingrediente_id,
        seccion_super: porId.get(f.ingrediente_id)!.seccion_super,
        origen: f.origen,
      })),
    );
    if (error) throw error;
  }
  for (const a of cambios.actualizar) {
    const item = automaticos.find((i) => i.id === a.id)!;
    const { error } = await supabase
      .from("item_lista")
      .update({ cantidad: texto(item.ingrediente_id!, a.cantidad), cantidad_base: a.cantidad, origen: a.origen })
      .eq("id", a.id);
    if (error) throw error;
  }
  if (cambios.borrar.length) {
    const { error } = await supabase.from("item_lista").delete().in("id", cambios.borrar);
    if (error) throw error;
  }
  return { anadidos: cambios.crear.length, actualizados: cambios.actualizar.length, quitados: cambios.borrar.length };
}

export function describirGeneracion({ anadidos, actualizados, quitados }: ResultadoGeneracion): string {
  const partes = [
    anadidos && `${anadidos} añadidos`,
    actualizados && `${actualizados} actualizados`,
    quitados && `${quitados} quitados`,
  ].filter(Boolean);
  return partes.length ? `Lista actualizada: ${partes.join(", ")}` : "La lista ya estaba al día";
}
