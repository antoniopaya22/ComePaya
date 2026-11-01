import { describe, expect, it } from "vitest";
import { primerosPasos, progreso, type EstadoHogar } from "./primeros-pasos";

const vacio: EstadoHogar = { lotes: 0, recetas: 0, franjasConReceta: 0, itemsLista: 0, miembros: 1, avisosActivos: false };

describe("primerosPasos", () => {
  it("en un hogar recién creado no hay nada hecho", () => {
    const pasos = primerosPasos(vacio);
    expect(pasos.map((p) => p.id)).toEqual(["despensa", "receta", "menu", "lista", "familia", "avisos"]);
    expect(pasos.every((p) => !p.hecho)).toBe(true);
    expect(progreso(pasos)).toBe(0);
  });

  it("marca lo que ya se ha hecho", () => {
    const pasos = primerosPasos({ ...vacio, lotes: 3, miembros: 2, avisosActivos: true });
    expect(pasos.filter((p) => p.hecho).map((p) => p.id)).toEqual(["despensa", "familia", "avisos"]);
    expect(progreso(pasos)).toBe(0.5);
  });

  it("sin notificaciones en el dispositivo no pide activarlas", () => {
    const pasos = primerosPasos({ lotes: 1, recetas: 1, franjasConReceta: 1, itemsLista: 1, miembros: 2, avisosActivos: false }, false);
    expect(pasos.some((p) => p.id === "avisos")).toBe(false);
    expect(progreso(pasos)).toBe(1);
  });
});
