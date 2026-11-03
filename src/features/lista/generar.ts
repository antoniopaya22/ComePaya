import { hoyISO, sumarDias } from "@/dominio/caducidad";
import { calcularFaltantes, sincronizarAutomaticos, type OrigenAutomatico } from "@/dominio/compra";
import { necesidadesDelMenu, type RecetaPlan } from "@/dominio/menu";
import { formatearCantidad } from "@/dominio/unidades";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Ingrediente, ItemLista, LoteConProducto, RecetaCompleta } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { consultarFranjas } from "../datos";
import { stockDeLotes } from "../despensa/stock";

export interface ResultadoGeneracion {
  anadidos: number;
  actualizados: number;
  quitados: number;
  nombresQuitados: string[];
  deshacer: () => Promise<void>;
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

  const crear = cambios.crear.map((f) => ({
    id: crypto.randomUUID(),
    texto: porId.get(f.ingrediente_id)!.nombre,
    cantidad: texto(f.ingrediente_id, f.cantidad),
    cantidad_base: f.cantidad,
    ingrediente_id: f.ingrediente_id,
    seccion_super: porId.get(f.ingrediente_id)!.seccion_super,
    origen: f.origen,
  }));
  const actualizar = cambios.actualizar.map((a) => {
    const item = automaticos.find((i) => i.id === a.id)!;
    return { id: a.id, cantidad: texto(item.ingrediente_id!, a.cantidad), cantidad_base: a.cantidad, origen: a.origen };
  });
  // Todo en una transacción y de uno en uno por hogar: dos móviles a la vez no duplican la lista.
  await aplicarCambiosLista(hogarId, { crear, actualizar, borrar: cambios.borrar });

  // Para deshacer: se borran las creadas, las cambiadas vuelven a lo de antes y las quitadas vuelven.
  const anteriores = actualizar.map((a) => automaticos.find((i) => i.id === a.id)!);
  const quitados = items.filter((i) => cambios.borrar.includes(i.id));
  return {
    anadidos: crear.length,
    actualizados: actualizar.length,
    quitados: quitados.length,
    nombresQuitados: quitados.map((i) => i.texto),
    deshacer: () =>
      aplicarCambiosLista(hogarId, {
        crear: quitados,
        actualizar: anteriores.map((i) => ({ id: i.id, cantidad: i.cantidad, cantidad_base: i.cantidad_base, origen: i.origen })),
        borrar: crear.map((c) => c.id),
      }),
  };
}

async function aplicarCambiosLista(hogarId: string, c: { crear: object[]; actualizar: object[]; borrar: string[] }) {
  if (!c.crear.length && !c.actualizar.length && !c.borrar.length) return;
  const { error } = await supabase.rpc("aplicar_cambios_lista", { p_hogar_id: hogarId, p_crear: c.crear, p_actualizar: c.actualizar, p_borrar: c.borrar });
  if (error) throw error;
}

/** Aviso del resultado, con lo que se ha quitado y "Deshacer" si ha cambiado algo. */
export function avisarGeneracion(resultado: ResultadoGeneracion, refrescar: () => void) {
  const cambio = resultado.anadidos + resultado.actualizados + resultado.quitados > 0;
  const quitados = resultado.nombresQuitados.length ? ` Quitado (ya no hace falta): ${resultado.nombresQuitados.join(", ").toLowerCase()}.` : "";
  toast.success(describirGeneracion(resultado), {
    description: `Con el menú de los próximos 7 días y lo que hay en casa.${quitados}`,
    duration: cambio ? 8000 : undefined,
    action: cambio
      ? {
          label: "Deshacer",
          onClick: async () => {
            try {
              await resultado.deshacer();
              toast.success("Deshecho");
            } catch (error) {
              toast.error(`No se ha podido deshacer: ${mensajeError(error)}`);
            } finally {
              refrescar();
            }
          },
        }
      : undefined,
  });
}

export function describirGeneracion({ anadidos, actualizados, quitados }: Pick<ResultadoGeneracion, "anadidos" | "actualizados" | "quitados">): string {
  const partes = [
    anadidos && `${anadidos} añadidos`,
    actualizados && `${actualizados} actualizados`,
    quitados && `${quitados} quitados`,
  ].filter(Boolean);
  return partes.length ? `Lista actualizada: ${partes.join(", ")}` : "La lista ya estaba al día";
}
