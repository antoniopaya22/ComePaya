import { describe, expect, it } from "vitest";
import { candidatosUnion, convertir, factorFusion, necesitaPesoUnidad } from "./fusion.js";

describe("factorFusion", () => {
  it("misma unidad o g y ml: no cambia", () => {
    expect(factorFusion("g", "g", null)).toBe(1);
    expect(factorFusion("g", "ml", null)).toBe(1);
    expect(factorFusion("ud", "ud", null)).toBe(1);
  });

  it("de unidades a gramos multiplica por lo que pesa una", () => {
    expect(necesitaPesoUnidad("ud", "g")).toBe(true);
    expect(factorFusion("ud", "g", 500)).toBe(500);
    expect(factorFusion("ud", "g", null)).toBeNull();
  });

  it("de gramos a unidades divide", () => {
    expect(factorFusion("g", "ud", 250)).toBe(1 / 250);
    expect(convertir(100, 1 / 250)).toBe(0.4);
  });

  it("nunca deja una cantidad en cero", () => {
    expect(convertir(0.1, 1 / 5000)).toBe(0.001);
  });
});

describe("candidatosUnion", () => {
  const producto = (id: string, nombre: string, ingrediente_id: string, ingrediente: string) => ({
    id,
    nombre,
    marca: null,
    ingrediente_id,
    ingrediente: { nombre: ingrediente },
  });
  const productos = [
    producto("p1", "Gnochis de patata", "noquis", "Ñoquis"),
    producto("p2", "Aceite de oliva virgen extra", "aceite-oliva", "Aceite de oliva"),
    producto("p3", "Gnochi rellenos", "gnochi", "Gnochi"),
  ];
  const ingredientes = [
    { id: "gnochi", nombre: "Gnochi" },
    { id: "noquis", nombre: "Ñoquis" },
    { id: "aceite-oliva", nombre: "Aceite de oliva" },
    { id: "aceite-girasol", nombre: "Aceite de girasol" },
  ];

  it("separa lo que hay en casa de lo comprado antes y quita los del propio ingrediente", () => {
    const r = candidatosUnion("gnochi", productos, ingredientes, new Map([["p2", 750]]), "");
    expect(r.enCasa.map((p) => p.id)).toEqual(["p2"]);
    expect(r.antes.map((p) => p.id)).toEqual(["p1"]);
    expect(r.otros).toEqual([]);
  });

  it("al buscar incluye ingredientes sin productos", () => {
    const r = candidatosUnion("gnochi", productos, ingredientes, new Map(), "aceite");
    expect(r.antes.map((p) => p.id)).toEqual(["p2"]);
    expect(r.otros.map((i) => i.id)).toEqual(["aceite-girasol"]);
  });

  it("busca también por el nombre del ingrediente del producto", () => {
    const r = candidatosUnion("gnochi", productos, ingredientes, new Map(), "ñoquis");
    expect(r.antes.map((p) => p.id)).toEqual(["p1"]);
  });
});
