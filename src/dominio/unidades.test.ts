import { describe, expect, it } from "vitest";
import { baseAEnvases, envasesABase, formatearCantidad, formatearLote } from "./unidades";

describe("formatearCantidad", () => {
  it.each([
    [250, "g", "250 g"],
    [1500, "g", "1,5 kg"],
    [1000, "ml", "1 l"],
    [330, "ml", "330 ml"],
    [3, "ud", "3 ud"],
    [0.5, "ud", "0,5 ud"],
  ] as const)("%s %s → %s", (cantidad, unidad, texto) => {
    expect(formatearCantidad(cantidad, unidad)).toBe(texto);
  });
});

describe("formatearLote", () => {
  it("muestra envases cuando el producto los declara", () => {
    expect(formatearLote(800, "g", 400)).toBe("2 × 400 g");
    expect(formatearLote(600, "g", 400)).toBe("1,5 × 400 g");
    expect(formatearLote(6000, "ml", 1000)).toBe("6 × 1 l");
  });

  it("muestra la cantidad base sin envase, con un solo envase o en unidades", () => {
    expect(formatearLote(750, "g", null)).toBe("750 g");
    expect(formatearLote(400, "g", 400)).toBe("400 g");
    expect(formatearLote(12, "ud", 1)).toBe("12 ud");
    expect(formatearLote(6, "ud", 12)).toBe("6 ud");
  });
});

describe("conversión envases ↔ unidad base", () => {
  it("convierte en ambos sentidos", () => {
    expect(envasesABase(3, 400)).toBe(1200);
    expect(baseAEnvases(1200, 400)).toBe(3);
  });

  it("sin envase, un envase equivale a una unidad base", () => {
    expect(envasesABase(2, null)).toBe(2);
    expect(baseAEnvases(2, null)).toBe(2);
  });
});
