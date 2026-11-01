import { describe, expect, it } from "vitest";
import { agruparPorSeccion, buscarIngrediente, parsearEntrada, seccionesDisponibles } from "./lista";

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
