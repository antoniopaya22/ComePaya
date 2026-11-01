import { describe, expect, it } from "vitest";
import { calcularFaltantes, envasesParaCubrir, sincronizarAutomaticos, stockPorIngrediente, ubicacionPorSeccion } from "./compra";

const ing = (id: string, extra: { siempre_disponible?: boolean; stock_minimo?: number | null } = {}) => ({
  id,
  siempre_disponible: false,
  stock_minimo: null,
  ...extra,
});

describe("stockPorIngrediente", () => {
  it("suma los lotes de cada ingrediente", () => {
    expect(
      stockPorIngrediente([
        { ingrediente_id: "leche", cantidad: 1000 },
        { ingrediente_id: "leche", cantidad: 500 },
        { ingrediente_id: "huevo", cantidad: 6 },
      ]),
    ).toEqual(
      new Map([
        ["leche", 1500],
        ["huevo", 6],
      ]),
    );
  });
});

describe("calcularFaltantes", () => {
  it("resta la despensa a lo que pide el menú", () => {
    const faltantes = calcularFaltantes(new Map([["lenteja", 600], ["arroz", 200]]), new Map([["lenteja", 500], ["arroz", 1000]]), [
      ing("lenteja"),
      ing("arroz"),
    ]);
    expect(faltantes).toEqual([{ ingrediente_id: "lenteja", cantidad: 100, origen: "menu" }]);
  });

  it("nunca pide los básicos siempre disponibles", () => {
    expect(calcularFaltantes(new Map([["sal", 10]]), new Map(), [ing("sal", { siempre_disponible: true })])).toEqual([]);
  });

  it("repone el stock mínimo aunque el menú no lo pida", () => {
    expect(calcularFaltantes(new Map(), new Map([["leche", 1000]]), [ing("leche", { stock_minimo: 3000 })])).toEqual([
      { ingrediente_id: "leche", cantidad: 2000, origen: "stock_minimo" },
    ]);
  });

  it("deja el stock mínimo después de cocinar", () => {
    // Hay 6 huevos, el menú gasta 4 y el mínimo es 6: faltan 4 para que queden 6.
    expect(calcularFaltantes(new Map([["huevo", 4]]), new Map([["huevo", 6]]), [ing("huevo", { stock_minimo: 6 })])).toEqual([
      { ingrediente_id: "huevo", cantidad: 4, origen: "stock_minimo" },
    ]);
    // Si el menú pide más de lo que hay, el origen es el menú y además se repone el mínimo.
    expect(calcularFaltantes(new Map([["huevo", 8]]), new Map([["huevo", 6]]), [ing("huevo", { stock_minimo: 6 })])).toEqual([
      { ingrediente_id: "huevo", cantidad: 8, origen: "menu" },
    ]);
  });

  it("cuenta lo ya comprado que aún no está en la despensa", () => {
    expect(calcularFaltantes(new Map([["pollo", 500]]), new Map(), [ing("pollo")], new Map([["pollo", 500]]))).toEqual([]);
  });

  it("evita restos de coma flotante", () => {
    const faltantes = calcularFaltantes(new Map([["aceite", 0.3]]), new Map([["aceite", 0.1]]), [ing("aceite")]);
    expect(faltantes[0].cantidad).toBe(0.2);
  });
});

describe("sincronizarAutomaticos", () => {
  it("crea, actualiza y borra solo lo necesario", () => {
    const cambios = sincronizarAutomaticos(
      [
        { id: "1", ingrediente_id: "lenteja", cantidad_base: 100, origen: "menu" },
        { id: "2", ingrediente_id: "arroz", cantidad_base: 200, origen: "menu" },
        { id: "3", ingrediente_id: "leche", cantidad_base: 2000, origen: "stock_minimo" },
      ],
      [
        { ingrediente_id: "lenteja", cantidad: 300, origen: "menu" },
        { ingrediente_id: "leche", cantidad: 2000, origen: "stock_minimo" },
        { ingrediente_id: "huevo", cantidad: 6, origen: "menu" },
      ],
    );
    expect(cambios).toEqual({
      crear: [{ ingrediente_id: "huevo", cantidad: 6, origen: "menu" }],
      actualizar: [{ id: "1", cantidad: 300, origen: "menu" }],
      borrar: ["2"],
    });
  });

  it("no duplica lo que ya se apuntó a mano y retira el automático equivalente", () => {
    const cambios = sincronizarAutomaticos(
      [{ id: "1", ingrediente_id: "lenteja", cantidad_base: 100, origen: "menu" }],
      [
        { ingrediente_id: "lenteja", cantidad: 300, origen: "menu" },
        { ingrediente_id: "huevo", cantidad: 6, origen: "menu" },
      ],
      new Set(["lenteja"]),
    );
    expect(cambios).toEqual({ crear: [{ ingrediente_id: "huevo", cantidad: 6, origen: "menu" }], actualizar: [], borrar: ["1"] });
  });

  it("elimina duplicados del mismo ingrediente", () => {
    const cambios = sincronizarAutomaticos(
      [
        { id: "1", ingrediente_id: "huevo", cantidad_base: 6, origen: "menu" },
        { id: "2", ingrediente_id: "huevo", cantidad_base: 6, origen: "menu" },
      ],
      [{ ingrediente_id: "huevo", cantidad: 6, origen: "menu" }],
    );
    expect(cambios).toEqual({ crear: [], actualizar: [], borrar: ["2"] });
  });
});

describe("ubicacionPorSeccion", () => {
  it.each([
    ["Congelados", "congelador"],
    ["Lácteos y huevos", "nevera"],
    ["Carnicería", "nevera"],
    ["Conservas", "despensa"],
    ["Otros", "despensa"],
  ])("%s → %s", (seccion, ubicacion) => {
    expect(ubicacionPorSeccion(seccion)).toBe(ubicacion);
  });
});

describe("envasesParaCubrir", () => {
  it("redondea hacia arriba a envases enteros", () => {
    expect(envasesParaCubrir(600, 400)).toBe(2);
    expect(envasesParaCubrir(800, 400)).toBe(2);
    expect(envasesParaCubrir(1, 400)).toBe(1);
  });

  it("devuelve 1 sin datos", () => {
    expect(envasesParaCubrir(null, 400)).toBe(1);
    expect(envasesParaCubrir(600, null)).toBe(1);
  });
});
