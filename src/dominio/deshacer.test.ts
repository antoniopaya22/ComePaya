import { describe, expect, it } from "vitest";
import { planRestaurar, planVacio, productosAfectados, type FotoLote } from "./deshacer.js";

const lote = (id: string, cambios: Partial<FotoLote> = {}): FotoLote => ({
  id,
  producto_id: "p1",
  cantidad: 6,
  ubicacion: "despensa",
  fecha_caducidad: "2026-12-01",
  abierto_en: null,
  ...cambios,
});

describe("productosAfectados", () => {
  it("reúne los productos de movimientos, lotes nuevos y lotes tocados, sin repetir", () => {
    const lotes = [lote("a"), lote("b", { producto_id: "p2" }), lote("c", { producto_id: "p3" })];
    const cambios = {
      lotes_delta: [{ id: "a" }],
      lotes_actualizar: [{ id: "b" }],
      lotes_borrar: ["c", "desconocido"],
      lotes_crear: [{ producto_id: "p4" }],
      movimientos: [{ producto_id: "p1" }],
    };
    expect(productosAfectados(cambios, lotes).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

describe("planRestaurar", () => {
  it("consumir parte: devuelve la cantidad", () => {
    const plan = planRestaurar([lote("a")], [lote("a", { cantidad: 4 })]);
    expect(plan).toEqual({ lotes_crear: [], lotes_actualizar: [lote("a")], lotes_borrar: [] });
  });

  it("consumir todo (el lote se borró): lo crea de nuevo con sus datos", () => {
    const plan = planRestaurar([lote("a", { abierto_en: "2026-11-01" })], []);
    expect(plan.lotes_crear).toEqual([
      { producto_id: "p1", cantidad: 6, ubicacion: "despensa", fecha_caducidad: "2026-12-01", abierto_en: "2026-11-01" },
    ]);
    expect(plan.lotes_actualizar).toEqual([]);
  });

  it("abrir un envase de varios: borra el abierto nuevo y devuelve el resto", () => {
    const plan = planRestaurar([lote("a")], [lote("a", { cantidad: 5 }), lote("nuevo", { cantidad: 1, ubicacion: "nevera", abierto_en: "2026-11-03" })]);
    expect(plan.lotes_borrar).toEqual(["nuevo"]);
    expect(plan.lotes_actualizar).toEqual([lote("a")]);
  });

  it("mover a otro sitio y caducidad cambiada: vuelve todo como estaba", () => {
    const plan = planRestaurar([lote("a")], [lote("a", { ubicacion: "nevera", fecha_caducidad: null })]);
    expect(plan.lotes_actualizar).toEqual([lote("a")]);
  });

  it("sin cambios no hay nada que hacer", () => {
    expect(planVacio(planRestaurar([lote("a")], [lote("a")]))).toBe(true);
  });
});
