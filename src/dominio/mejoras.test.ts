import { describe, expect, it } from "vitest";
import { agruparPorProducto } from "./despensa";
import { duracionMinutos, extraerRecetaJsonLd, parsearLineaIngrediente } from "./importar";
import { emojiPara, INGREDIENTES_BASE, ingredientesBaseQueFaltan } from "./ingredientes-base";
import { SECCIONES_POR_DEFECTO } from "./lista";
import { mismoNombre } from "./texto";

describe("ingredientes base", () => {
  it("usan secciones conocidas y no repiten nombres", () => {
    for (const i of INGREDIENTES_BASE) expect(SECCIONES_POR_DEFECTO).toContain(i.seccion_super);
    const repetidos = INGREDIENTES_BASE.filter((a, i) => INGREDIENTES_BASE.some((b, j) => j < i && mismoNombre(a.nombre, b.nombre)));
    expect(repetidos.map((r) => r.nombre)).toEqual([]);
  });

  it("los que se cuentan por unidades llevan peso salvo los no comestibles", () => {
    const sinPeso = INGREDIENTES_BASE.filter((i) => i.unidad_base === "ud" && !i.peso_unidad_g && !["Droguería", "Higiene"].includes(i.seccion_super));
    expect(sinPeso).toEqual([]);
  });

  it("solo propone los que faltan, sin importar plurales ni tildes", () => {
    const faltan = ingredientesBaseQueFaltan([{ nombre: "tomates" }, { nombre: "LIMON" }]);
    expect(faltan.some((i) => i.nombre === "Tomate")).toBe(false);
    expect(faltan.some((i) => i.nombre === "Limón")).toBe(false);
    expect(faltan.length).toBe(INGREDIENTES_BASE.length - 2);
  });

  it("elige el icono propio, el del ingrediente base o el de la sección", () => {
    expect(emojiPara("Tomates", "Fruta y verdura", "🍒")).toBe("🍒");
    expect(emojiPara("tomates", "Otros")).toBe("🍅");
    expect(emojiPara("Pan de pueblo", "Panadería")).toBe("🥖");
    expect(emojiPara("Cosa rara", null)).toBe("🛒");
  });
});

describe("agruparPorProducto", () => {
  const lote = (id: string, producto_id: string, cantidad: number, fecha_caducidad: string | null, nombre = producto_id) => ({
    id,
    producto_id,
    cantidad,
    fecha_caducidad,
    creado_en: "2026-10-01",
    producto: { nombre },
  });

  it("suma por producto y ordena por la caducidad más próxima", () => {
    const grupos = agruparPorProducto([
      lote("1", "leche", 1000, "2026-12-01"),
      lote("2", "arroz", 1000, null, "Arroz"),
      lote("3", "leche", 1000, "2026-11-05"),
      lote("4", "yogur", 4, "2026-11-03"),
      lote("5", "aceite", 1000, null, "Aceite"),
    ]);
    expect(grupos.map((g) => [g.producto_id, g.total, g.proxima])).toEqual([
      ["yogur", 4, "2026-11-03"],
      ["leche", 2000, "2026-11-05"],
      ["aceite", 1000, null],
      ["arroz", 1000, null],
    ]);
    expect(grupos[1].lotes.map((l) => l.id)).toEqual(["3", "1"]);
  });
});

describe("importar recetas", () => {
  it.each([
    ["400 g de lentejas", "Lentejas", 400, "g", false],
    ["1/2 kg de patatas", "Patatas", 500, "g", false],
    ["2 cucharadas de aceite de oliva", "Aceite de oliva", 30, "ml", true],
    ["1 ½ vasos de agua", "Agua", 300, "ml", true],
    ["3 dientes de ajo", "Ajo", 3, "ud", false],
    ["2 huevos", "Huevos", 2, "ud", false],
    ["un chorizo (unos 200 g)", "Chorizo", 1, "ud", false],
    ["1 l de caldo, caliente", "Caldo", 1000, "ml", false],
  ] as const)("%s", (linea, nombre, cantidad, unidad, aproximada) => {
    expect(parsearLineaIngrediente(linea)).toMatchObject({ nombre, cantidad, unidad, aproximada });
  });

  it("deja sin cantidad lo que va al gusto", () => {
    expect(parsearLineaIngrediente("Sal al gusto")).toMatchObject({ nombre: "Sal", cantidad: null });
  });

  it("convierte duraciones ISO 8601", () => {
    expect(duracionMinutos("PT1H30M")).toBe(90);
    expect(duracionMinutos("PT45M")).toBe(45);
    expect(duracionMinutos("P0DT2H")).toBe(120);
    expect(duracionMinutos("45 min")).toBeNull();
  });

  it("extrae la receta de un JSON-LD con @graph, secciones y HTML", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Blog"}</script>
      <script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["Recipe"],"name":"Lentejas &amp; chorizo",
        "recipeYield":["4 raciones"],"prepTime":"PT10M","cookTime":"PT45M","image":[{"url":"https://x.test/f.jpg"}],
        "recipeIngredient":["400 g de lentejas"," 1 chorizo "],
        "recipeInstructions":[{"@type":"HowToSection","name":"Sofrito","itemListElement":[{"@type":"HowToStep","text":"Pica la <b>cebolla</b>."}]},
          {"@type":"HowToStep","text":"Cuece 40 min."}]}]}</script></head></html>`;
    expect(extraerRecetaJsonLd(html)).toEqual({
      nombre: "Lentejas & chorizo",
      raciones: 4,
      tiempo_prep_min: 10,
      tiempo_coccion_min: 45,
      ingredientes: ["400 g de lentejas", "1 chorizo"],
      pasos: ["Pica la cebolla.", "Cuece 40 min."],
      imagen: "https://x.test/f.jpg",
    });
  });

  it("acepta instrucciones como texto y devuelve null si no hay receta", () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"X","recipeInstructions":"<p>Uno</p><p>Dos</p>"}</script>`;
    expect(extraerRecetaJsonLd(html)?.pasos).toEqual(["Uno", "Dos"]);
    expect(extraerRecetaJsonLd("<html></html>")).toBeNull();
    expect(extraerRecetaJsonLd(`<script type="application/ld+json">{roto</script>`)).toBeNull();
  });
});
