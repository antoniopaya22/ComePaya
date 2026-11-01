import { describe, expect, it } from "vitest";
import { planDescuento } from "./despensa";

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
