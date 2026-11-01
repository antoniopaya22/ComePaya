import { describe, expect, it } from "vitest";
import { mismoNombre, normalizar } from "./texto";

describe("normalizar", () => {
  it("quita tildes, mayúsculas y espacios sobrantes", () => {
    expect(normalizar("  Atún   en ACEITE ")).toBe("atun en aceite");
    expect(normalizar("Ñoquis")).toBe("noquis");
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
