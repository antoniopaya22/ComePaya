import { dividirRecetas, markdownAReceta, recetaAMarkdown, SEPARADOR_RECETAS, type RecetaMarkdown } from "@/dominio/markdown";
import { convertir, factorFusion } from "@/dominio/fusion";
import { buscarIngrediente } from "@/dominio/lista";
import { normalizar } from "@/dominio/texto";
import { supabase } from "@/lib/supabase";
import type { Ingrediente, RecetaCompleta } from "@/lib/tipos";
import { obtenerOCrearIngrediente } from "../despensa/altas";

export function aMarkdown(r: RecetaCompleta): string {
  return recetaAMarkdown({
    nombre: r.nombre,
    raciones: r.raciones,
    tiempo_prep_min: r.tiempo_prep_min,
    tiempo_coccion_min: r.tiempo_coccion_min,
    etiquetas: r.etiquetas,
    valoracion: r.valoracion,
    preparacion_previa: r.preparacion_previa,
    preparacion_previa_horas: r.preparacion_previa_horas,
    ingredientes: r.ingredientes.map((i) => ({ nombre: i.ingrediente.nombre, cantidad: i.cantidad, unidad: i.ingrediente.unidad_base, opcional: i.opcional })),
    pasos: r.pasos.map((p) => ({ texto: p.texto, temporizador_seg: p.temporizador_seg, temporizador_nombre: p.temporizador_nombre })),
    notas: r.notas,
  });
}

/** Descarga un archivo de texto generado en el navegador. */
export function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/markdown;charset=utf-8" }));
  const enlace = Object.assign(document.createElement("a"), { href: url, download: nombre });
  enlace.click();
  URL.revokeObjectURL(url);
}

export function nombreArchivo(nombre: string): string {
  return `${normalizar(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "receta"}.md`;
}

export function exportarTodas(recetas: RecetaCompleta[]) {
  descargar("recetas.md", recetas.map(aMarkdown).join(SEPARADOR_RECETAS));
}

/**
 * Importa recetas desde archivos Markdown. Crea los ingredientes que falten con la unidad indicada.
 * Las que ya existen con el mismo nombre se saltan para no duplicarlas.
 */
export async function importar(
  hogarId: string,
  textos: string[],
  ingredientes: Ingrediente[],
  existentes: string[],
): Promise<{ importadas: string[]; saltadas: string[]; errores: string[] }> {
  const resultado = { importadas: [] as string[], saltadas: [] as string[], errores: [] as string[] };
  const conocidos = [...ingredientes];
  const nombres = new Set(existentes.map(normalizar));

  for (const texto of textos.flatMap(dividirRecetas)) {
    let receta: RecetaMarkdown;
    try {
      receta = markdownAReceta(texto);
    } catch (error) {
      resultado.errores.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (nombres.has(normalizar(receta.nombre))) {
      resultado.saltadas.push(receta.nombre);
      continue;
    }
    try {
      const lineas = [];
      for (const ing of receta.ingredientes) {
        // Si el ingrediente ya existe con otra unidad ("200 g" de patata, que va por unidades), se convierte.
        const existente = buscarIngrediente(ing.nombre, conocidos);
        let cantidad = ing.cantidad;
        if (existente?.unidad_base && existente.unidad_base !== ing.unidad) {
          const factor = factorFusion(ing.unidad, existente.unidad_base, existente.peso_unidad_g ?? null);
          if (factor === null) {
            throw new Error(`«${ing.nombre}» viene en ${ing.unidad} y en casa va en ${existente.unidad_base}: indica cuánto pesa una unidad en Ajustes → Ingredientes`);
          }
          cantidad = convertir(ing.cantidad, factor);
        }
        const id = await obtenerOCrearIngrediente(hogarId, ing.nombre, { unidad_base: ing.unidad }, conocidos);
        if (!conocidos.some((c) => c.id === id)) conocidos.push({ id, nombre: ing.nombre, unidad_base: ing.unidad, peso_unidad_g: null } as Ingrediente);
        lineas.push({ ingrediente_id: id, cantidad, opcional: ing.opcional });
      }
      const { error } = await supabase.rpc("guardar_receta", {
        p_receta: {
          id: "",
          hogar_id: hogarId,
          nombre: receta.nombre,
          raciones: receta.raciones,
          tiempo_prep_min: receta.tiempo_prep_min ?? "",
          tiempo_coccion_min: receta.tiempo_coccion_min ?? "",
          preparacion_previa: receta.preparacion_previa ?? "",
          preparacion_previa_horas: receta.preparacion_previa_horas ?? "",
          etiquetas: receta.etiquetas,
          valoracion: receta.valoracion ?? "",
          notas: receta.notas ?? "",
        },
        p_ingredientes: lineas,
        p_pasos: receta.pasos.map((p) => ({ texto: p.texto, temporizador_seg: p.temporizador_seg ?? "", temporizador_nombre: p.temporizador_nombre ?? "" })),
      });
      if (error) throw error;
      resultado.importadas.push(receta.nombre);
      nombres.add(normalizar(receta.nombre));
    } catch (error) {
      resultado.errores.push(`${receta.nombre}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return resultado;
}
