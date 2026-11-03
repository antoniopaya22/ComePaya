import { describe, expect, it } from "vitest";
import { agruparPorSeccion, buscarIngrediente, cantidadEnBase, dividirDictado, habituales, parsearEntrada, seccionesDisponibles, textoParaCompartir } from "./lista.js";

const item = (id: string, seccion: string, marcado = false, creado_en = `2026-11-01T10:00:0${id}Z`) => ({
  id,
  seccion_super: seccion,
  marcado,
  creado_en,
});

describe("agruparPorSeccion", () => {
  const orden = ["Fruta y verdura", "Carnicería", "Lácteos y huevos", "Otros"];

  it("ordena las secciones según el recorrido de la tienda", () => {
    const grupos = agruparPorSeccion(
      [item("1", "Lácteos y huevos"), item("2", "Fruta y verdura"), item("3", "Carnicería")],
      orden,
    );
    expect(grupos.map((g) => g.seccion)).toEqual(["Fruta y verdura", "Carnicería", "Lácteos y huevos"]);
  });

  it("pone las secciones desconocidas detrás por orden alfabético y Otros al final", () => {
    const grupos = agruparPorSeccion(
      [item("1", "Otros"), item("2", "Pescadería"), item("3", "Bebidas"), item("4", "Carnicería")],
      orden,
    );
    expect(grupos.map((g) => g.seccion)).toEqual(["Carnicería", "Bebidas", "Pescadería", "Otros"]);
  });

  it("trata la sección vacía como Otros", () => {
    const grupos = agruparPorSeccion([item("1", "  ")], orden);
    expect(grupos.map((g) => g.seccion)).toEqual(["Otros"]);
  });

  it("deja lo marcado al final de cada sección y cuenta lo pendiente", () => {
    const [grupo] = agruparPorSeccion(
      [item("1", "Carnicería", true), item("2", "Carnicería"), item("3", "Carnicería")],
      orden,
    );
    expect(grupo.items.map((i) => i.id)).toEqual(["2", "3", "1"]);
    expect(grupo.pendientes).toBe(2);
  });

  it("devuelve una lista vacía si no hay elementos", () => {
    expect(agruparPorSeccion([], orden)).toEqual([]);
  });
});

describe("parsearEntrada", () => {
  it.each([
    ["2 kg de tomates", "Tomates", "2 kg"],
    ["3 latas atún", "Atún", "3 latas"],
    ["500g carne picada", "Carne picada", "500g"],
    ["1,5 l leche", "Leche", "1,5 l"],
    ["leche x6", "Leche", "x6"],
    ["huevos 2 docenas", "Huevos", "2 docenas"],
    ["2 gambas", "Gambas", "2"],
    ["1 lechuga", "Lechuga", "1"],
    ["  pan   de molde ", "Pan de molde", null],
    ["7up", "7up", null],
  ])("%s → %s (%s)", (entrada, texto, cantidad) => {
    expect(parsearEntrada(entrada)).toEqual({ texto, cantidad });
  });
});

describe("buscarIngrediente", () => {
  const ingredientes = [
    { id: "a", nombre: "Tomate", seccion_super: "Fruta y verdura" },
    { id: "b", nombre: "Limón", seccion_super: "Fruta y verdura" },
    { id: "c", nombre: "Pechuga de pollo", seccion_super: "Carnicería" },
  ];

  it("ignora mayúsculas, tildes y plurales", () => {
    expect(buscarIngrediente("TOMATES", ingredientes)?.id).toBe("a");
    expect(buscarIngrediente("limones", ingredientes)?.id).toBe("b");
    expect(buscarIngrediente("pechugas de pollo", ingredientes)?.id).toBe("c");
  });

  it("no inventa coincidencias parciales", () => {
    expect(buscarIngrediente("tomate frito", ingredientes)).toBeNull();
    expect(buscarIngrediente("", ingredientes)).toBeNull();
  });
});

describe("textoParaCompartir", () => {
  it("solo lo pendiente, por secciones", () => {
    const grupos = agruparPorSeccion(
      [
        { ...item("1", "Panadería"), texto: "Pan", cantidad: null },
        { ...item("2", "Fruta y verdura"), texto: "Tomate", cantidad: "2 kg" },
        { ...item("3", "Fruta y verdura", true), texto: "Plátano", cantidad: null },
      ],
      ["Fruta y verdura", "Panadería"],
    );
    expect(textoParaCompartir(grupos)).toBe("🛒 Lista de la compra\n\n*Fruta y verdura*\n• Tomate (2 kg)\n\n*Panadería*\n• Pan");
  });

  it("avisa si no queda nada", () => {
    expect(textoParaCompartir([])).toContain("vacía");
  });
});

describe("dividirDictado", () => {
  it.each([
    ["leche, dos kilos de tomates y pan", ["leche", "dos kilos de tomates", "pan"]],
    ["huevos e higos.", ["huevos", "higos"]],
    ["yogures", ["yogures"]],
    ["Leche y pan y café", ["Leche", "pan", "café"]],
  ])("%s", (dictado, esperado) => {
    expect(dividirDictado(dictado)).toEqual(esperado);
  });
});

describe("habituales", () => {
  it("lo más comprado que no esté ya en la lista, con al menos dos compras", () => {
    expect(habituales(["leche", "pan", "leche", "huevo", "pan", "leche", "atun"], new Set(["pan"]))).toEqual(["leche"]);
    expect(habituales(["a", "a", "b", "b", "b"], new Set(), 1)).toEqual(["b"]);
  });
});

describe("seccionesDisponibles", () => {
  it("respeta el orden de la tienda, añade las usadas y deja Otros al final", () => {
    expect(seccionesDisponibles(["Carnicería", "Otros", "Bebidas"], ["Mascotas", "Bebidas", ""])).toEqual([
      "Carnicería",
      "Bebidas",
      "Mascotas",
      "Otros",
    ]);
  });

  it("usa las secciones por defecto si la tienda no tiene ninguna", () => {
    const secciones = seccionesDisponibles([], []);
    expect(secciones[0]).toBe("Fruta y verdura");
    expect(secciones.at(-1)).toBe("Otros");
  });
});

describe("cantidadEnBase", () => {
  it.each([
    ["2 kg", "g", null, 2000],
    ["500g", "g", null, 500],
    ["1,5 l", "ml", null, 1500],
    ["33 cl", "ml", null, 330],
    ["x6", "ud", null, 6],
    ["2 docenas", "ud", null, 24],
    ["3", "ud", null, 3],
    ["1 kg", "ud", 200, 5],
    ["100 g", "ud", 200, 1],
    ["4", "g", 150, 600],
    ["4", "g", null, null],
    ["1 kg", "ud", null, null],
    ["3 latas", "g", null, null],
    ["un poco", "g", null, null],
    [null, "g", null, null],
  ] as const)("%s en %s (pieza %s g) → %s", (texto, unidad, peso, esperado) => {
    expect(cantidadEnBase(texto, unidad, peso)).toBe(esperado);
  });
});
