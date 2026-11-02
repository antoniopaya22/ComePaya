import { describe, expect, it } from "vitest";
import {
  aditivosVigilados,
  contarGrupos,
  evaluarEquilibrio,
  gruposDeReceta,
  nutricionPorRacion,
  nutrientesDeIngrediente,
  REGLAS_POR_DEFECTO,
  type GrupoAlimento,
} from "./nutricion.js";

describe("nutrientesDeIngrediente", () => {
  it("prefiere los valores manuales", () => {
    expect(nutrientesDeIngrediente({ kcal: 100 }, [{ kcal: 300 }])).toEqual({ kcal: 100 });
  });

  it("promedia cada nutriente entre los productos que lo tienen", () => {
    expect(nutrientesDeIngrediente(null, [{ kcal: 100, sal: 1 }, { kcal: 200 }, null, {}])).toEqual({ kcal: 150, sal: 1 });
  });

  it("devuelve null sin datos", () => {
    expect(nutrientesDeIngrediente({}, [null])).toBeNull();
  });
});

describe("nutricionPorRacion", () => {
  const lenteja = { nombre: "Lenteja", unidad_base: "g" as const, peso_unidad_g: null, nutrientes_100: { kcal: 350, proteina: 24, fibra: 11 } };
  const huevo = { nombre: "Huevo", unidad_base: "ud" as const, peso_unidad_g: 60, nutrientes_100: { kcal: 150, proteina: 12.5 } };
  const chorizo = { nombre: "Chorizo", unidad_base: "g" as const, peso_unidad_g: null, nutrientes_100: null };
  const pimenton = { nombre: "Pimentón", unidad_base: "g" as const, peso_unidad_g: null, nutrientes_100: { kcal: 300 } };

  it("suma por cantidad y divide entre raciones", () => {
    const r = nutricionPorRacion(4, [
      { cantidad: 400, opcional: false, ingrediente: lenteja },
      { cantidad: 4, opcional: false, ingrediente: huevo },
    ]);
    // Lenteja: 1400 kcal, 96 g prot, 44 g fibra. Huevo: 4 × 60 g = 240 g → 360 kcal, 30 g prot.
    expect(r.porRacion).toEqual({ kcal: 440, proteina: 31.5, fibra: 11 });
    expect(r.sinDatos).toEqual([]);
  });

  it("indica qué ingredientes no tienen datos y no cuenta los opcionales", () => {
    const r = nutricionPorRacion(2, [
      { cantidad: 200, opcional: false, ingrediente: lenteja },
      { cantidad: 100, opcional: false, ingrediente: chorizo },
      { cantidad: 2, opcional: false, ingrediente: { ...huevo, peso_unidad_g: null } },
      { cantidad: 5, opcional: true, ingrediente: pimenton },
    ]);
    expect(r.porRacion.kcal).toBe(350);
    expect(r.sinDatos).toEqual(["Chorizo", "Huevo"]);
  });
});

describe("equilibrio semanal", () => {
  const grupos = new Map<string, Set<GrupoAlimento>>([
    ["lentejas", gruposDeReceta([{ opcional: false, grupo: "legumbre" }, { opcional: false, grupo: "carne_roja" }, { opcional: true, grupo: "verdura" }])],
    ["merluza", new Set<GrupoAlimento>(["pescado", "verdura"])],
    ["pizza", new Set<GrupoAlimento>(["ultraprocesado"])],
  ]);

  it("los opcionales no aportan grupo", () => {
    expect([...grupos.get("lentejas")!]).toEqual(["legumbre", "carne_roja"]);
  });

  it("cuenta comidas por grupo, sin las de fuera de casa", () => {
    const cuenta = contarGrupos(
      [
        { receta_id: "lentejas", fuera_de_casa: false },
        { receta_id: "lentejas", fuera_de_casa: false },
        { receta_id: "merluza", fuera_de_casa: false },
        { receta_id: "pizza", fuera_de_casa: true },
        { receta_id: null, fuera_de_casa: false },
      ],
      grupos,
    );
    expect(cuenta).toEqual(
      new Map<GrupoAlimento, number>([
        ["legumbre", 2],
        ["carne_roja", 2],
        ["pescado", 1],
        ["verdura", 1],
      ]),
    );
  });

  it("avisa de lo que falta y de lo que sobra", () => {
    const cuenta = new Map<GrupoAlimento, number>([
      ["legumbre", 1],
      ["ultraprocesado", 3],
      ["verdura", 7],
    ]);
    expect(evaluarEquilibrio(cuenta, REGLAS_POR_DEFECTO).map((a) => a.mensaje)).toEqual([
      "Solo 1 comida con legumbres (mín. 3)",
      "Esta semana no hay pescado",
      "3 comidas con ultraprocesados (máx. 2)",
    ]);
  });
});

describe("aditivosVigilados", () => {
  it("encuentra los aditivos marcados sin importar mayúsculas", () => {
    expect(aditivosVigilados(["E330", "E250", "E621"], ["e250", " E621 "])).toEqual(["E250", "E621"]);
  });
});
