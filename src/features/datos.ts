import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { alergenosDeIngrediente, type Alergeno } from "@/dominio/alergenos";
import { nutrientesDeIngrediente, REGLAS_POR_DEFECTO, type Regla } from "@/dominio/nutricion";
import type { Nutrientes100 } from "@/dominio/producto-externo";
import { supabase } from "@/lib/supabase";
import { sumarDias, type FechaISO } from "@/dominio/caducidad";
import type {
  FranjaMenu,
  Ingrediente,
  ItemLista,
  LoteConProducto,
  Miembro,
  ProductoConIngrediente,
  RacionCongelada,
  RecetaCompleta,
  Tienda,
} from "@/lib/tipos";
import { useHogar } from "./hogar/HogarProvider";

// Consultas compartidas por las pantallas. Todas filtran por el hogar activo; RLS lo garantiza igualmente.

export const claves = {
  ingredientes: (hogarId: string) => ["ingredientes", hogarId],
  productos: (hogarId: string) => ["productos", hogarId],
  lotes: (hogarId: string) => ["lotes", hogarId],
  tiendas: (hogarId: string) => ["tiendas", hogarId],
  lista: (hogarId: string) => ["lista", hogarId],
  miembros: (hogarId: string) => ["miembros", hogarId],
  recetas: (hogarId: string) => ["recetas", hogarId],
  franjas: (hogarId: string) => ["franjas", hogarId],
  reglas: (hogarId: string) => ["reglas", hogarId],
  raciones: (hogarId: string) => ["raciones", hogarId],
};

export function useRacionesCongeladas() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.raciones(hogar.id),
    queryFn: () =>
      filas<RacionCongelada>(supabase.from("racion_congelada").select("*").eq("hogar_id", hogar.id).order("fecha_congelacion")),
  });
}

/** Reglas de equilibrio del hogar; si no ha configurado ninguna, las de referencia (AESAN). */
export function useReglas() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.reglas(hogar.id),
    queryFn: async () => {
      const reglas = await filas<Regla>(supabase.from("regla_semanal").select("grupo_alimento, minimo_semana, maximo_semana").eq("hogar_id", hogar.id));
      return reglas.length ? reglas : REGLAS_POR_DEFECTO;
    },
  });
}

/** Alérgenos de cada ingrediente: los marcados a mano más los de sus productos. */
export function useAlergenosIngredientes(): Map<string, Alergeno[]> {
  const { data: ingredientes = [] } = useIngredientes();
  const { data: productos = [] } = useProductos();
  return useMemo(
    () =>
      new Map(
        ingredientes.map((i) => [
          i.id,
          alergenosDeIngrediente(
            i.alergenos,
            productos.filter((p) => p.ingrediente_id === i.id).map((p) => p.alergenos),
          ),
        ]),
      ),
    [ingredientes, productos],
  );
}

/** Nutrientes por 100 g de cada ingrediente: manuales o media de sus productos con datos. */
export function useNutrientesIngredientes(): Map<string, Nutrientes100 | null> {
  const { data: ingredientes = [] } = useIngredientes();
  const { data: productos = [] } = useProductos();
  return useMemo(
    () =>
      new Map(
        ingredientes.map((i) => [
          i.id,
          nutrientesDeIngrediente(
            i.nutrientes_100,
            productos.filter((p) => p.ingrediente_id === i.id).map((p) => p.nutrientes_100),
          ),
        ]),
      ),
    [ingredientes, productos],
  );
}

// Para un hogar el recetario completo cabe en una consulta: así el menú, la lista y las recetas comparten datos.
const SELECT_RECETA =
  "*, ingredientes:receta_ingrediente(id, ingrediente_id, cantidad, opcional, orden, ingrediente:ingrediente(id, nombre, unidad_base)), pasos:paso_receta(id, orden, texto, temporizador_seg, temporizador_nombre)";

export function ordenarReceta(receta: RecetaCompleta): RecetaCompleta {
  return {
    ...receta,
    ingredientes: [...receta.ingredientes].sort((a, b) => a.orden - b.orden),
    pasos: [...receta.pasos].sort((a, b) => a.orden - b.orden),
  };
}

export function useRecetas() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.recetas(hogar.id),
    queryFn: async () =>
      (await filas<RecetaCompleta>(supabase.from("receta").select(SELECT_RECETA).eq("hogar_id", hogar.id).order("nombre"))).map(
        ordenarReceta,
      ),
  });
}

export function consultarFranjas(hogarId: string, desde: FechaISO, hasta: FechaISO) {
  return filas<FranjaMenu>(
    supabase.from("franja_menu").select("*").eq("hogar_id", hogarId).gte("fecha", desde).lte("fecha", hasta).order("fecha"),
  );
}

/** Franjas de la semana que empieza en `lunes`. */
export function useFranjas(lunes: FechaISO) {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: [...claves.franjas(hogar.id), lunes],
    queryFn: () => consultarFranjas(hogar.id, lunes, sumarDias(lunes, 6)),
  });
}

async function filas<T>(consulta: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useIngredientes() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.ingredientes(hogar.id),
    queryFn: () => filas<Ingrediente>(supabase.from("ingrediente").select("*").eq("hogar_id", hogar.id).order("nombre")),
  });
}

export function useProductos() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.productos(hogar.id),
    queryFn: () =>
      filas<ProductoConIngrediente>(
        supabase
          .from("producto")
          .select("*, ingrediente:ingrediente(id, nombre, unidad_base, caducidad_defecto_dias, emoji, seccion_super, dias_tras_abrir)")
          .eq("hogar_id", hogar.id)
          .order("nombre"),
      ),
  });
}

export function consultarLotes(hogarId: string) {
  return filas<LoteConProducto>(
    supabase
      .from("lote_despensa")
      .select("*, producto:producto(*, ingrediente:ingrediente(id, nombre, unidad_base, caducidad_defecto_dias, emoji, seccion_super, dias_tras_abrir))")
      .eq("hogar_id", hogarId)
      .order("fecha_caducidad", { ascending: true, nullsFirst: false })
      .order("creado_en"),
  );
}

export function useLotes() {
  const { hogar } = useHogar();
  return useQuery({ queryKey: claves.lotes(hogar.id), queryFn: () => consultarLotes(hogar.id) });
}

export function useTiendas() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.tiendas(hogar.id),
    queryFn: () => filas<Tienda>(supabase.from("tienda").select("*").eq("hogar_id", hogar.id).order("creado_en")),
  });
}

export function useLista() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.lista(hogar.id),
    queryFn: () => filas<ItemLista>(supabase.from("item_lista").select("*").eq("hogar_id", hogar.id).order("creado_en")),
  });
}

export function useMiembros() {
  const { hogar } = useHogar();
  return useQuery({
    queryKey: claves.miembros(hogar.id),
    queryFn: () => filas<Miembro>(supabase.from("miembro").select("*").eq("hogar_id", hogar.id).order("creado_en")),
  });
}

const CLAVE_TIENDA = "despensa.tienda-activa";

/** Tienda con la que se ordena la lista; se recuerda por dispositivo. */
export function leerTiendaActiva(hogarId: string): string | null {
  try {
    return localStorage.getItem(`${CLAVE_TIENDA}.${hogarId}`);
  } catch {
    return null;
  }
}

export function guardarTiendaActiva(hogarId: string, tiendaId: string) {
  try {
    localStorage.setItem(`${CLAVE_TIENDA}.${hogarId}`, tiendaId);
  } catch {
    // Sin almacenamiento se usa la primera tienda.
  }
}
