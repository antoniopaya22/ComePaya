import { describe, expect, it } from "vitest";
import { cumpleFiltroSalud, describirDatoSalud, ordenarPorSalud, resumirSalud, tieneDatos, type DatosSalud } from "./salud-despensa.js";

const d = (x: Partial<DatosSalud>): DatosSalud => ({ nutriscore: null, nova: null, nutrientes: null, niveles: null, ...x });

const galletas = d({ nutriscore: "e", nova: 4, nutrientes: { kcal: 480, azucares: 30, sal: 0.8, proteina: 6 }, niveles: { azucares: "alto", sal: "moderado" } });
const lentejas = d({ nutrientes: { kcal: 330, proteina: 24, azucares: 2, sal: 0.1 } });
const leche = d({ nutriscore: "b", nova: 1, nutrientes: { kcal: 46, proteina: 3.2, azucares: 4.7, sal: 0.1 } });
const chorizo = d({ nutriscore: "e", nova: 4, nutrientes: { kcal: 450, sal: 4 } });
const pan = d({});

describe("filtros de salud", () => {
  it("ultraprocesado es NOVA 4", () => {
    expect([galletas, lentejas, leche, chorizo].filter((x) => cumpleFiltroSalud(x, "ultraprocesado"))).toEqual([galletas, chorizo]);
  });

  it("alto en azúcar o sal: por sus niveles o, si no los trae, por los umbrales por 100 g", () => {
    expect(cumpleFiltroSalud(galletas, "azucar")).toBe(true);
    expect(cumpleFiltroSalud(galletas, "sal")).toBe(false); // trae nivel "moderado"
    expect(cumpleFiltroSalud(chorizo, "sal")).toBe(true); // 4 g > 1,5 g
    expect(cumpleFiltroSalud(leche, "azucar")).toBe(false);
  });

  it("sin datos: ni notas ni nutrientes", () => {
    expect(cumpleFiltroSalud(pan, "sin_datos")).toBe(true);
    expect(tieneDatos(lentejas)).toBe(true);
    expect(tieneDatos(d({ nutrientes: {} }))).toBe(false);
  });
});

describe("ordenarPorSalud", () => {
  const grupos = [
    { n: "galletas", d: galletas },
    { n: "pan", d: pan },
    { n: "lentejas", d: lentejas },
    { n: "leche", d: leche },
    { n: "chorizo", d: chorizo },
  ];
  const nombres = (o: Parameters<typeof ordenarPorSalud>[1]) => ordenarPorSalud(grupos, o, (g) => g.d).map((g) => g.n);

  it("Nutri-Score de mejor a peor; sin nota al final y en el orden que venían", () => {
    expect(nombres("nutriscore")).toEqual(["leche", "galletas", "chorizo", "pan", "lentejas"]);
  });

  it("nutrientes de más a menos", () => {
    expect(nombres("proteina")).toEqual(["lentejas", "galletas", "leche", "pan", "chorizo"]);
    expect(nombres("sal")[0]).toBe("chorizo");
  });
});

describe("describirDatoSalud", () => {
  it("el dato por el que se ordena", () => {
    expect(describirDatoSalud(lentejas, "proteina")).toBe("24 g proteína/100 g");
    expect(describirDatoSalud(leche, "azucares")).toBe("4,7 g azúcar/100 g");
    expect(describirDatoSalud(galletas, "kcal")).toBe("480 kcal/100 g");
    expect(describirDatoSalud(pan, "sal")).toBe("sin dato");
    expect(describirDatoSalud(leche, "nutriscore")).toBeNull();
  });
});

describe("resumirSalud", () => {
  it("cuenta letras, ultraprocesados y lo que no tiene datos", () => {
    const r = resumirSalud([galletas, lentejas, leche, chorizo, pan]);
    expect(r.nutriscore).toEqual({ a: 0, b: 1, c: 0, d: 0, e: 2 });
    expect(r).toMatchObject({ ultraprocesados: 2, altoAzucar: 1, altoSal: 1, sinDatos: 1, total: 5 });
  });
});
