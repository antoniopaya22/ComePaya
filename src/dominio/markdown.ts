import type { UnidadBase } from "./unidades.js";

// Recetas en Markdown con frontmatter (§4.3): legibles y versionables en Git.

export interface RecetaMarkdown {
  nombre: string;
  raciones: number;
  tiempo_prep_min: number | null;
  tiempo_coccion_min: number | null;
  etiquetas: string[];
  valoracion: number | null;
  preparacion_previa: string | null;
  preparacion_previa_horas: number | null;
  ingredientes: { nombre: string; cantidad: number; unidad: UnidadBase; opcional: boolean }[];
  pasos: { texto: string; temporizador_seg: number | null; temporizador_nombre: string | null }[];
  notas: string | null;
}

/** Separa varias recetas en un mismo archivo de exportación. */
export const SEPARADOR_RECETAS = "\n<!-- siguiente receta -->\n";

const numero = (n: number) => String(Math.round(n * 1000) / 1000);

export function recetaAMarkdown(r: RecetaMarkdown): string {
  const frontmatter = [
    "---",
    `nombre: ${r.nombre}`,
    `raciones: ${r.raciones}`,
    r.tiempo_prep_min !== null && `tiempo_prep_min: ${r.tiempo_prep_min}`,
    r.tiempo_coccion_min !== null && `tiempo_coccion_min: ${r.tiempo_coccion_min}`,
    r.etiquetas.length > 0 && `etiquetas: [${r.etiquetas.join(", ")}]`,
    r.valoracion !== null && `valoracion: ${r.valoracion}`,
    r.preparacion_previa && `preparacion_previa: ${r.preparacion_previa}`,
    r.preparacion_previa && r.preparacion_previa_horas !== null && `preparacion_previa_horas: ${r.preparacion_previa_horas}`,
    "---",
  ].filter(Boolean);

  const ingredientes = r.ingredientes.map((i) => `- ${numero(i.cantidad)} ${i.unidad} ${i.nombre}${i.opcional ? " (opcional)" : ""}`);
  const pasos = r.pasos.map((p, n) => {
    const temporizador = p.temporizador_seg
      ? ` [temporizador: ${numero(p.temporizador_seg / 60)} min${p.temporizador_nombre ? ` ${p.temporizador_nombre}` : ""}]`
      : "";
    return `${n + 1}. ${p.texto.replace(/\n+/g, " ")}${temporizador}`;
  });

  return [
    ...frontmatter,
    "",
    `# ${r.nombre}`,
    "",
    "## Ingredientes",
    "",
    ...ingredientes,
    ...(pasos.length ? ["", "## Pasos", "", ...pasos] : []),
    ...(r.notas ? ["", "## Notas", "", r.notas] : []),
    "",
  ].join("\n");
}

/** Lee una receta exportada (o escrita a mano con el mismo formato). Lanza un error legible si no es válida. */
export function markdownAReceta(texto: string): RecetaMarkdown {
  const coincidencia = /^\s*---\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/.exec(texto);
  if (!coincidencia) throw new Error("Falta el bloque de cabecera (---) con el nombre de la receta");
  const meta = new Map<string, string>();
  for (const linea of coincidencia[1].split(/\r?\n/)) {
    const m = /^\s*([a-z_]+)\s*:\s*(.*)$/.exec(linea);
    if (m) meta.set(m[1], m[2].trim());
  }
  const nombre = meta.get("nombre");
  if (!nombre) throw new Error("La receta no tiene nombre");
  const entero = (clave: string) => {
    const v = meta.get(clave);
    return v && /^\d+$/.test(v) ? Number(v) : null;
  };

  const secciones = new Map<string, string[]>();
  let actual = "";
  for (const linea of coincidencia[2].split(/\r?\n/)) {
    const titulo = /^##\s+(.+)$/.exec(linea);
    if (titulo) {
      actual = titulo[1].trim().toLowerCase();
      secciones.set(actual, []);
    } else if (actual) {
      secciones.get(actual)!.push(linea);
    }
  }

  const ingredientes = (secciones.get("ingredientes") ?? [])
    .map((l) => /^\s*[-*]\s+(\d+(?:[.,]\d+)?)\s*(g|ml|ud)\s+(.+?)\s*$/i.exec(l))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => {
      const opcional = /\(opcional\)\s*$/i.test(m[3]);
      return {
        cantidad: Number(m[1].replace(",", ".")),
        unidad: m[2].toLowerCase() as UnidadBase,
        nombre: m[3].replace(/\s*\(opcional\)\s*$/i, "").trim(),
        opcional,
      };
    });
  if (!ingredientes.length) throw new Error(`«${nombre}» no tiene ingredientes con el formato "- 400 g Lenteja"`);

  const pasos = (secciones.get("pasos") ?? [])
    .map((l) => /^\s*\d+[.)]\s+(.+)$/.exec(l)?.[1])
    .filter((p): p is string => Boolean(p))
    .map((p) => {
      const t = /\s*\[temporizador:\s*(\d+(?:[.,]\d+)?)\s*min\s*([^\]]*)\]\s*$/i.exec(p);
      return {
        texto: t ? p.slice(0, t.index).trim() : p.trim(),
        temporizador_seg: t ? Math.round(Number(t[1].replace(",", ".")) * 60) : null,
        temporizador_nombre: t?.[2].trim() || null,
      };
    });

  const notas = (secciones.get("notas") ?? []).join("\n").trim() || null;
  const etiquetas = (meta.get("etiquetas") ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const valoracion = entero("valoracion");

  return {
    nombre,
    raciones: entero("raciones") ?? 2,
    tiempo_prep_min: entero("tiempo_prep_min"),
    tiempo_coccion_min: entero("tiempo_coccion_min"),
    etiquetas,
    valoracion: valoracion && valoracion >= 1 && valoracion <= 5 ? valoracion : null,
    preparacion_previa: meta.get("preparacion_previa") || null,
    preparacion_previa_horas: entero("preparacion_previa_horas"),
    ingredientes,
    pasos,
    notas,
  };
}

/** Un archivo puede traer varias recetas separadas por SEPARADOR_RECETAS. */
export function dividirRecetas(texto: string): string[] {
  return texto
    .split(SEPARADOR_RECETAS.trim())
    .map((t) => t.trim())
    .filter(Boolean);
}
