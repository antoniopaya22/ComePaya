import { describe, expect, it } from "vitest";
import { mismoNombre, normalizar, puntuarBusqueda } from "./texto.js";

describe("normalizar", () => {
  it("quita tildes, mayúsculas y espacios sobrantes", () => {
    expect(normalizar("  Atún   en ACEITE ")).toBe("atun en aceite");
    expect(normalizar("Ñoquis")).toBe("noquis");
  });
});

describe("puntuarBusqueda", () => {
  it("ordena por cómo coincide", () => {
    expect(puntuarBusqueda("Lentejas con chorizo", "lent")).toBe(1);
    expect(puntuarBusqueda("Lentejas con chorizo", "chori")).toBe(0.8);
    expect(puntuarBusqueda("Tomate frito", "ate")).toBe(0.6);
    expect(puntuarBusqueda("Lentejas", "cuchara", ["legumbre", "cuchara"])).toBe(0.4);
  });

  it("ignora tildes y mayúsculas y exige todas las palabras", () => {
    expect(puntuarBusqueda("Atún en aceite", "ATUN aceite")).toBeGreaterThan(0);
    expect(puntuarBusqueda("Atún en aceite", "atun tomate")).toBe(0);
  });

  it("sin búsqueda todo coincide", () => {
    expect(puntuarBusqueda("Lo que sea", "  ")).toBe(1);
  });
});

describe("mismoNombre", () => {
  it.each([
    ["tomates", "Tomate"],
    ["limones", "Limón"],
    ["Pechugas de pollo", "pechuga de pollo"],
    ["nueces", "nuez"],
    ["arroz", "Arroz"],
  ])("%s = %s", (a, b) => {
    expect(mismoNombre(a, b)).toBe(true);
  });

  it.each([
    ["tomate frito", "tomate"],
    ["pollo", "pavo"],
    ["", ""],
  ])("%s ≠ %s", (a, b) => {
    expect(mismoNombre(a, b)).toBe(false);
  });
});
