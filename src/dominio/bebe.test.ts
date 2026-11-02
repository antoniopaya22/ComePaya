import { describe, expect, it } from "vitest";
import { alimentosNuevos, esRecetaDeBebe, limpiarNombreBebe, paraDe, recetasPara } from "./bebe.js";

describe("recetas de bebé", () => {
  const pure = { nombre: "Puré de verduras", etiquetas: ["Bebé"] };
  const papilla = { nombre: "Papilla de frutas", etiquetas: ["bebe", "merienda"] };
  const lentejas = { nombre: "Lentejas", etiquetas: ["legumbre"] };

  it("reconoce la etiqueta con o sin tilde y mayúsculas", () => {
    expect(esRecetaDeBebe(pure)).toBe(true);
    expect(esRecetaDeBebe(papilla)).toBe(true);
    expect(esRecetaDeBebe(lentejas)).toBe(false);
  });

  it("separa las recetas de la casa y las del bebé", () => {
    expect(recetasPara("casa", [pure, papilla, lentejas])).toEqual([lentejas]);
    expect(recetasPara("bebe", [pure, papilla, lentejas])).toEqual([pure, papilla]);
  });

  it("sin recetas de bebé, para el bebé valen todas", () => {
    expect(recetasPara("bebe", [lentejas])).toEqual([lentejas]);
  });
});

describe("alimentosNuevos", () => {
  it("lo que no ha probado, sin opcionales ni repetidos", () => {
    const introducidos = new Map([
      ["patata", "2026-10-01"],
      ["zanahoria", null],
    ]);
    const ingredientes = [
      { ingrediente_id: "patata", opcional: false },
      { ingrediente_id: "zanahoria", opcional: false },
      { ingrediente_id: "puerro", opcional: false },
      { ingrediente_id: "zanahoria", opcional: false },
      { ingrediente_id: "aceite", opcional: true },
    ];
    expect(alimentosNuevos(ingredientes, introducidos)).toEqual(["zanahoria", "puerro"]);
  });
});

describe("varios", () => {
  it("las franjas sin `para` son de la casa", () => {
    expect(paraDe({})).toBe("casa");
    expect(paraDe({ para: "bebe" })).toBe("bebe");
  });

  it("limpia el nombre del bebé", () => {
    expect(limpiarNombreBebe("  Lucía  ")).toBe("Lucía");
    expect(limpiarNombreBebe("   ")).toBeNull();
  });
});
