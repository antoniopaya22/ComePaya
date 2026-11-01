import { datosBaseDe } from "@/dominio/ingredientes-base";
import { buscarIngrediente } from "@/dominio/lista";
import { dividirRecetas, markdownAReceta, recetaAMarkdown, SEPARADOR_RECETAS, type RecetaMarkdown } from "@/dominio/markdown";
import { normalizar } from "@/dominio/texto";
import { supabase } from "@/lib/supabase";
import type { Ingrediente, RecetaCompleta } from "@/lib/tipos";

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
        let existente = buscarIngrediente(ing.nombre, conocidos);
        if (!existente) {
          const { data, error } = await supabase
            .from("ingrediente")
            .insert({ ...datosBaseDe(ing.nombre), hogar_id: hogarId, nombre: ing.nombre, unidad_base: ing.unidad })
            .select("*")
            .single();
          if (error) throw error;
          existente = data as Ingrediente;
          conocidos.push(existente);
        }
        lineas.push({ ingrediente_id: existente.id, cantidad: ing.cantidad, opcional: ing.opcional });
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
