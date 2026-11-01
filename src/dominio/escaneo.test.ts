import { describe, expect, it } from "vitest";
import { ingredienteSugerido, preguntarCaducidad } from "./escaneo";

describe("ingredienteSugerido", () => {
  it.each([
    ["Tomate triturado Hacendado", "Hacendado", "Tomate triturado"],
    ["Leche semidesnatada Pascual 1 l", "Pascual", "Leche semidesnatada"],
    ["Garbanzo cocido Hacendado bote 400 g", "Hacendado", "Garbanzo cocido"],
    ["Nutella", "Nutella, Ferrero", "Nutella"],
    ["atún claro en aceite pack 3 x 80 g", null, "Atún claro en aceite"],
    ["Chorizo dulce Revilla", "Revilla", "Chorizo dulce"],
  ])("%s (%s) → %s", (nombre, marca, esperado) => {
    expect(ingredienteSugerido(nombre, marca)).toBe(esperado);
  });
});

describe("preguntarCaducidad", () => {
  it("pregunta siempre en nevera y congelador", () => {
    expect(preguntarCaducidad("nevera", null)).toBe(true);
    expect(preguntarCaducidad("congelador", null)).toBe(true);
  });

  it("en la despensa solo si el producto suele caducar", () => {
    expect(preguntarCaducidad("despensa", null)).toBe(false);
    expect(preguntarCaducidad("despensa", 30)).toBe(true);
  });
});
