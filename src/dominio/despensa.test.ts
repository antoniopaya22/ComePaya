import { describe, expect, it } from "vitest";
import { cantidadesRapidas, planDescuento, planMover, ubicacionHabitual, type LoteMovible } from "./despensa.js";

const lote = (id: string, cantidad: number, fecha_caducidad: string | null, creado_en = "2026-10-01") => ({
  id,
  cantidad,
  fecha_caducidad,
  creado_en,
});

describe("planDescuento", () => {
  it("gasta primero lo que caduca antes", () => {
    const plan = planDescuento([lote("tarde", 400, "2027-01-01"), lote("pronto", 400, "2026-11-05")], 500);
    expect(plan).toEqual({
      lotes: [
        { id: "pronto", consumido: 400, restante: 0 },
        { id: "tarde", consumido: 100, restante: 300 },
      ],
      sinCubrir: 0,
    });
  });

  it("deja para el final lo que no tiene fecha y, a igualdad, usa lo más antiguo", () => {
    const plan = planDescuento(
      [lote("sin-fecha", 100, null), lote("nuevo", 100, "2026-12-01", "2026-10-20"), lote("viejo", 100, "2026-12-01", "2026-10-01")],
      250,
    );
    expect(plan.lotes.map((l) => l.id)).toEqual(["viejo", "nuevo", "sin-fecha"]);
    expect(plan.lotes.at(-1)).toEqual({ id: "sin-fecha", consumido: 50, restante: 50 });
  });

  it("indica lo que no había", () => {
    expect(planDescuento([lote("a", 100, null)], 250)).toEqual({ lotes: [{ id: "a", consumido: 100, restante: 0 }], sinCubrir: 150 });
    expect(planDescuento([], 3)).toEqual({ lotes: [], sinCubrir: 3 });
  });
});

describe("planMover", () => {
  const yogures: LoteMovible = { id: "y", producto_id: "p", cantidad: 6, ubicacion: "despensa", fecha_caducidad: "2026-11-20", abierto_en: null };

  it("separa la parte movida en un lote nuevo", () => {
    expect(planMover(yogures, 2, "nevera", [])).toEqual({
      deltas: [{ id: "y", delta: -2 }],
      crear: { producto_id: "p", cantidad: 2, ubicacion: "nevera", fecha_caducidad: "2026-11-20", abierto_en: null },
    });
  });

  it("si se mueve todo, el lote solo cambia de sitio", () => {
    expect(planMover(yogures, 6, "nevera", [])).toEqual({ cambiarUbicacion: { id: "y", ubicacion: "nevera" }, deltas: [] });
    expect(planMover(yogures, 9, "nevera", [])?.cambiarUbicacion).toBeDefined();
  });

  it("se junta con un lote igual del destino", () => {
    const enNevera = { ...yogures, id: "n", ubicacion: "nevera", cantidad: 1 };
    expect(planMover(yogures, 2, "nevera", [enNevera])).toEqual({ deltas: [{ id: "y", delta: -2 }, { id: "n", delta: 2 }] });
  });

  it("no se junta con uno de otra caducidad o abierto", () => {
    const otraFecha = { ...yogures, id: "n", ubicacion: "nevera", fecha_caducidad: "2026-12-01" };
    const abierto = { ...yogures, id: "a", ubicacion: "nevera", abierto_en: "2026-11-01" };
    expect(planMover(yogures, 2, "nevera", [otraFecha, abierto])?.crear).toBeDefined();
  });

  it("nada que mover", () => {
    expect(planMover(yogures, 0, "nevera", [])).toBeNull();
    expect(planMover(yogures, 2, "despensa", [])).toBeNull();
  });
});

describe("alta rápida de frescos", () => {
  it("ofrece unidades o pesos según el ingrediente", () => {
    expect(cantidadesRapidas("ud")).toEqual({ opciones: [1, 2, 3, 6, 12], paso: 1, inicial: 1 });
    expect(cantidadesRapidas("g").opciones).toEqual([250, 500, 1000, 2000]);
    expect(cantidadesRapidas("g").inicial).toBe(500);
  });

  it("propone dónde se guarda", () => {
    expect(ubicacionHabitual("Panadería", "Pan")).toBe("despensa");
    expect(ubicacionHabitual("Fruta y verdura", "Patata")).toBe("despensa");
    expect(ubicacionHabitual("Fruta y verdura", "Plátano")).toBe("despensa");
    expect(ubicacionHabitual("Fruta y verdura", "Lechuga")).toBe("nevera");
    expect(ubicacionHabitual("Carnicería", "Pechuga de pollo")).toBe("nevera");
  });
});
