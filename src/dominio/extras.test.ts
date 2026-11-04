import { describe, expect, it } from "vitest";
import { cumplimientoSemanal, masCocinadas, masTirados } from "./estadisticas.js";
import { generarIcal } from "./ical.js";
import { dividirRecetas, markdownAReceta, recetaAMarkdown, SEPARADOR_RECETAS, type RecetaMarkdown } from "./markdown.js";
import type { GrupoAlimento } from "./nutricion.js";

const lentejas: RecetaMarkdown = {
  nombre: "Lentejas con chorizo",
  raciones: 4,
  tiempo_prep_min: 10,
  tiempo_coccion_min: 45,
  etiquetas: ["legumbre", "cuchara"],
  valoracion: 5,
  preparacion_previa: "Poner las lentejas en remojo",
  preparacion_previa_horas: 2,
  ingredientes: [
    { nombre: "Lenteja pardina", cantidad: 400, unidad: "g", opcional: false },
    { nombre: "Huevo", cantidad: 2, unidad: "ud", opcional: false },
    { nombre: "Pimentón", cantidad: 2.5, unidad: "g", opcional: true },
  ],
  pasos: [
    { texto: "Sofríe el chorizo.", temporizador_seg: null, temporizador_nombre: null },
    { texto: "Cuece hasta que estén tiernas.", temporizador_seg: 2400, temporizador_nombre: "Lentejas" },
  ],
  notas: "Mejor de un día para otro.",
};

describe("recetas en Markdown", () => {
  it("genera un Markdown legible", () => {
    expect(recetaAMarkdown(lentejas)).toBe(
      [
        "---",
        "nombre: Lentejas con chorizo",
        "raciones: 4",
        "tiempo_prep_min: 10",
        "tiempo_coccion_min: 45",
        "etiquetas: [legumbre, cuchara]",
        "valoracion: 5",
        "preparacion_previa: Poner las lentejas en remojo",
        "preparacion_previa_horas: 2",
        "---",
        "",
        "# Lentejas con chorizo",
        "",
        "## Ingredientes",
        "",
        "- 400 g Lenteja pardina",
        "- 2 ud Huevo",
        "- 2.5 g Pimentón (opcional)",
        "",
        "## Pasos",
        "",
        "1. Sofríe el chorizo.",
        "2. Cuece hasta que estén tiernas. [temporizador: 40 min Lentejas]",
        "",
        "## Notas",
        "",
        "Mejor de un día para otro.",
        "",
      ].join("\n"),
    );
  });

  it("ida y vuelta sin perder nada", () => {
    expect(markdownAReceta(recetaAMarkdown(lentejas))).toEqual(lentejas);
    const rara: RecetaMarkdown = {
      ...lentejas,
      etiquetas: ["rápida, fácil", 'con "comillas"', "[bebé]", "cena"],
      notas: "Primera línea\n\n## Truco\n\nMenos sal la próxima vez",
    };
    expect(markdownAReceta(recetaAMarkdown(rara))).toEqual(rara);
  });

  it("acepta recetas mínimas escritas a mano", () => {
    const r = markdownAReceta("---\nnombre: Tostadas\n---\n## Ingredientes\n* 2 ud Pan\n- 10,5 ml Aceite\n");
    expect(r).toMatchObject({ nombre: "Tostadas", raciones: 2, etiquetas: [], pasos: [], notas: null });
    expect(r.ingredientes).toEqual([
      { nombre: "Pan", cantidad: 2, unidad: "ud", opcional: false },
      { nombre: "Aceite", cantidad: 10.5, unidad: "ml", opcional: false },
    ]);
  });

  it("explica por qué no puede leer una receta", () => {
    expect(() => markdownAReceta("# Sin cabecera")).toThrow("cabecera");
    expect(() => markdownAReceta("---\nnombre: Nada\n---\n## Ingredientes\n- un poco de sal\n")).toThrow("no tiene ingredientes");
  });

  it("separa varias recetas de un mismo archivo", () => {
    const texto = recetaAMarkdown(lentejas) + SEPARADOR_RECETAS + recetaAMarkdown({ ...lentejas, nombre: "Otra" });
    expect(dividirRecetas(texto).map((t) => markdownAReceta(t).nombre)).toEqual(["Lentejas con chorizo", "Otra"]);
  });
});

describe("generarIcal", () => {
  it("crea un evento por franja planificada en hora de España", () => {
    const ical = generarIcal(
      "Casa",
      [
        { id: "f1", fecha: "2026-11-02", tipo: "comida", fuera_de_casa: false, es_sobra_de: null, receta: { nombre: "Lentejas, con chorizo" } },
        { id: "f2", fecha: "2026-11-02", tipo: "cena", fuera_de_casa: true, es_sobra_de: null, receta: null },
        { id: "f3", fecha: "2026-11-03", tipo: "comida", fuera_de_casa: false, es_sobra_de: "f1", receta: { nombre: "Lentejas" } },
        { id: "f4", fecha: "2026-11-03", tipo: "cena", fuera_de_casa: false, es_sobra_de: null, receta: null },
      ],
      new Date("2026-11-01T10:00:00Z"),
    );
    expect(ical).toContain("BEGIN:VCALENDAR\r\n");
    expect(ical).toContain("DTSTART;TZID=Europe/Madrid:20261102T140000\r\nDTEND;TZID=Europe/Madrid:20261102T150000");
    expect(ical).toContain("SUMMARY:Comida: Lentejas\\, con chorizo");
    expect(ical).toContain("SUMMARY:Cena: Fuera de casa");
    expect(ical).toContain("SUMMARY:Comida: Lentejas (sobras)");
    expect(ical.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ical).toContain("DTSTAMP:20261101T100000Z");
  });

  it("un salto de línea en un nombre no abre una línea nueva del calendario", () => {
    const ical = generarIcal("Casa\r\nX-INYECTADO:1", [], new Date("2026-11-01T10:00:00Z"));
    expect(ical).not.toMatch(/\r\nX-INYECTADO/);
    expect(ical).toContain("Casa\\nX-INYECTADO:1");
  });

  it("pliega las líneas largas", () => {
    const ical = generarIcal("Casa", [{ id: "f", fecha: "2026-11-02", tipo: "cena", fuera_de_casa: false, es_sobra_de: null, receta: { nombre: "Á".repeat(60) } }], new Date());
    for (const linea of ical.split("\r\n")) expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
  });
});

describe("estadísticas", () => {
  it("ordena lo más tirado", () => {
    expect(
      masTirados([
        { producto: "Leche", motivo: null },
        { producto: "Lechuga", motivo: null },
        { producto: "Lechuga", motivo: null },
      ]),
    ).toEqual([
      { producto: "Lechuga", veces: 2 },
      { producto: "Leche", veces: 1 },
    ]);
  });

  const f = (fecha: string, receta_id: string | null, extra = {}) => ({ fecha, receta_id, fuera_de_casa: false, es_sobra_de: null, cocinado: true, ...extra });

  it("cuenta lo cocinado sin las sobras", () => {
    expect(masCocinadas([f("2026-11-02", "a"), f("2026-11-03", "a", { es_sobra_de: "x" }), f("2026-11-04", "b"), f("2026-11-05", "a"), f("2026-11-06", "c", { cocinado: false })])).toEqual([
      { receta_id: "a", veces: 2 },
      { receta_id: "b", veces: 1 },
    ]);
  });

  it("evalúa cada semana con las reglas", () => {
    const grupos = new Map<string, Set<GrupoAlimento>>([["pescado", new Set(["pescado"])]]);
    const reglas = [{ grupo_alimento: "pescado" as const, minimo_semana: 2, maximo_semana: null }];
    expect(
      cumplimientoSemanal([f("2026-10-27", "pescado"), f("2026-10-28", "pescado"), f("2026-11-03", "pescado")], grupos, reglas),
    ).toEqual([
      { lunes: "2026-10-26", avisos: 0, cumple: true },
      { lunes: "2026-11-02", avisos: 1, cumple: false },
    ]);
  });
});
