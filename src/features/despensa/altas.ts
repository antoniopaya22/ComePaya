import { diasHasta, hoyISO, type FechaISO } from "@/dominio/caducidad";
import type { ProductoExterno } from "@/dominio/producto-externo";
import type { UnidadBase } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { Ingrediente, ProductoConIngrediente, Ubicacion } from "@/lib/tipos";
import { datosBaseDe, ingredientesBaseQueFaltan } from "@/dominio/ingredientes-base";
import { buscarIngrediente } from "@/dominio/lista";

/** Añade al hogar los ingredientes habituales que aún no tiene. Devuelve cuántos ha creado. */
export async function cargarIngredientesBase(hogarId: string, existentes: { nombre: string }[]): Promise<number> {
  const faltan = ingredientesBaseQueFaltan(existentes);
  if (!faltan.length) return 0;
  const { error } = await supabase.from("ingrediente").insert(faltan.map((i) => ({ ...i, hogar_id: hogarId })));
  if (error) throw error;
  return faltan.length;
}

const SELECT_PRODUCTO = "*, ingrediente:ingrediente(id, nombre, unidad_base, caducidad_defecto_dias, emoji, seccion_super)";

export interface DatosProductoNuevo {
  nombre: string;
  marca: string | null;
  ingrediente: string;
  unidad: UnidadBase;
  seccion: string;
  cantidadEnvase: number | null;
  ean?: string | null;
  externo?: ProductoExterno | null;
  fotoUrl?: string | null;
  mercadonaId?: string | null;
}

/** Crea (si hace falta) el ingrediente y el producto. Con datos externos guarda también su información de salud. */
export async function crearProducto(hogarId: string, datos: DatosProductoNuevo, ingredientes: Ingrediente[]): Promise<ProductoConIngrediente> {
  let ingredienteId = buscarIngrediente(datos.ingrediente, ingredientes)?.id;
  if (!ingredienteId) {
    const { data, error } = await supabase
      .from("ingrediente")
      .insert({
        ...datosBaseDe(datos.ingrediente),
        hogar_id: hogarId,
        nombre: datos.ingrediente.trim(),
        unidad_base: datos.unidad,
        seccion_super: datos.seccion,
      })
      .select("id")
      .single();
    if (error) throw error;
    ingredienteId = data.id as string;
  }
  const externo = datos.externo;
  const { data, error } = await supabase
    .from("producto")
    .insert({
      hogar_id: hogarId,
      ingrediente_id: ingredienteId,
      ean: datos.ean ?? null,
      nombre: datos.nombre.trim(),
      marca: datos.marca?.trim() || null,
      cantidad_envase: datos.unidad === "ud" ? (datos.cantidadEnvase ?? 1) : datos.cantidadEnvase,
      fuente: externo?.fuente ?? (datos.mercadonaId ? "mercadona" : "manual"),
      foto_url: datos.fotoUrl ?? externo?.foto_url ?? null,
      nutrientes_100: externo?.nutrientes_100 ?? null,
      nutriscore: externo?.nutriscore ?? null,
      nova: externo?.nova ?? null,
      niveles_nutrientes: externo?.niveles_nutrientes ?? null,
      aditivos: externo?.aditivos?.length ? externo.aditivos : null,
      completitud_datos: externo?.completitud_datos ?? null,
      mercadona_id: datos.mercadonaId ?? null,
    })
    .select(SELECT_PRODUCTO)
    .single();
  if (error) throw error;
  return data as ProductoConIngrediente;
}

/** Añade un lote, registra el movimiento y aprende la caducidad habitual del producto. Devuelve el id del lote. */
export async function anadirLote(
  hogarId: string,
  producto: ProductoConIngrediente,
  cantidad: number,
  ubicacion: Ubicacion,
  caducidad: FechaISO | null,
  motivo?: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("lote_despensa")
    .insert({ hogar_id: hogarId, producto_id: producto.id, cantidad, ubicacion, fecha_caducidad: caducidad })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("movimiento_despensa").insert({ hogar_id: hogarId, producto_id: producto.id, cantidad, tipo: "alta", motivo: motivo ?? null });
  const dias = caducidad ? diasHasta(caducidad, hoyISO()) : null;
  if (dias && dias > 0 && dias !== producto.caducidad_habitual_dias) {
    await supabase.from("producto").update({ caducidad_habitual_dias: dias }).eq("id", producto.id);
  }
  return data.id as string;
}
