import { describe, expect, it } from "vitest";
import { planDeshacer, planVacio, productosAfectados, type FotoLote } from "./deshacer.js";

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

describe("planDeshacer", () => {
  it("consumir parte: devuelve la cantidad con la diferencia", () => {
    const plan = planDeshacer([lote("a")], [lote("a", { cantidad: 4 })], [lote("a", { cantidad: 4 })]);
    expect(plan).toEqual({ lotes_crear: [], lotes_actualizar: [], lotes_delta: [{ id: "a", delta: 2 }], lotes_borrar: [] });
  });

  it("si el otro móvil gastó más después, se respeta: solo se devuelve lo de esta acción", () => {
    const plan = planDeshacer([lote("a")], [lote("a", { cantidad: 4 })], [lote("a", { cantidad: 1 })]);
    expect(plan.lotes_delta).toEqual([{ id: "a", delta: 2 }]);
  });

  it("consumir todo (el lote se borró): lo crea de nuevo con sus datos", () => {
    const plan = planDeshacer([lote("a", { abierto_en: "2026-11-01" })], [], []);
    expect(plan.lotes_crear).toEqual([
      { producto_id: "p1", cantidad: 6, ubicacion: "despensa", fecha_caducidad: "2026-12-01", abierto_en: "2026-11-01" },
    ]);
  });

  it("abrir un envase de varios: borra el abierto nuevo y devuelve el resto", () => {
    const despues = [lote("a", { cantidad: 5 }), lote("nuevo", { cantidad: 1, ubicacion: "nevera", abierto_en: "2026-11-03" })];
    const plan = planDeshacer([lote("a")], despues, despues);
    expect(plan.lotes_borrar).toEqual(["nuevo"]);
    expect(plan.lotes_delta).toEqual([{ id: "a", delta: 1 }]);
  });

  it("mover: vuelve al sitio de antes, salvo que el otro lo haya movido después", () => {
    const despues = [lote("a", { ubicacion: "nevera" })];
    expect(planDeshacer([lote("a")], despues, despues).lotes_actualizar).toEqual([{ id: "a", ubicacion: "despensa" }]);
    expect(planDeshacer([lote("a")], despues, [lote("a", { ubicacion: "congelador" })]).lotes_actualizar).toEqual([]);
  });

  it("no toca lo que otro móvil ha creado o quitado desde entonces", () => {
    const plan = planDeshacer([lote("a"), lote("b")], [lote("a", { cantidad: 4 }), lote("b")], [lote("a", { cantidad: 4 }), lote("otro")]);
    expect(plan).toEqual({ lotes_crear: [], lotes_actualizar: [], lotes_delta: [{ id: "a", delta: 2 }], lotes_borrar: [] });
  });

  it("sin cambios no hay nada que hacer", () => {
    expect(planVacio(planDeshacer([lote("a")], [lote("a")], [lote("a")]))).toBe(true);
  });
});
