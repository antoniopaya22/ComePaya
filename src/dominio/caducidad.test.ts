import { describe, expect, it } from "vitest";
import {
  ATAJOS_CADUCIDAD,
  deducirFecha,
  describirCaducidad,
  diasHasta,
  estadoCaducidad,
  etiquetaCaducidad,
  sumarDias,
  sumarMeses,
} from "./caducidad";

const HOY = "2026-11-01";

describe("aritmética de fechas", () => {
  it("suma días cruzando mes y año", () => {
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(sumarDias(HOY, -1)).toBe("2026-10-31");
  });

  it("suma meses sin desbordar a final de mes", () => {
    expect(sumarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(sumarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(sumarMeses(HOY, 6)).toBe("2027-05-01");
  });

  it("cuenta días aunque haya cambio de hora", () => {
    expect(diasHasta("2026-10-25", "2026-10-24")).toBe(1);
    expect(diasHasta("2027-03-29", "2027-03-27")).toBe(2);
  });
});

describe("estadoCaducidad", () => {
  it.each([
    [null, "sin_fecha"],
    ["2026-10-31", "caducado"],
    [HOY, "pronto"],
    ["2026-11-04", "pronto"],
    ["2026-11-05", "ok"],
  ] as const)("%s → %s", (fecha, estado) => {
    expect(estadoCaducidad(fecha, HOY)).toBe(estado);
  });
});

describe("describirCaducidad", () => {
  it.each([
    [null, "Sin caducidad"],
    ["2026-10-29", "Caducó hace 3 días"],
    ["2026-10-31", "Caducó ayer"],
    [HOY, "Caduca hoy"],
    ["2026-11-02", "Caduca mañana"],
    ["2026-11-20", "Caduca en 19 días"],
    ["2027-03-12", "Caduca el 12/03/2027"],
  ] as const)("%s → %s", (fecha, texto) => {
    expect(describirCaducidad(fecha, HOY)).toBe(texto);
  });
});

describe("etiquetaCaducidad", () => {
  it.each([
    [null, "Sin fecha"],
    ["2026-10-31", "Caducado"],
    [HOY, "Hoy"],
    ["2026-11-02", "Mañana"],
    ["2026-11-20", "19 días"],
    ["2027-03-12", "12/03/27"],
  ] as const)("%s → %s", (fecha, texto) => {
    expect(etiquetaCaducidad(fecha, HOY)).toBe(texto);
  });
});

describe("deducirFecha", () => {
  it("usa el año actual para fechas futuras o recientes", () => {
    expect(deducirFecha(15, 12, HOY)).toBe("2026-12-15");
    expect(deducirFecha(20, 10, HOY)).toBe("2026-10-20");
  });

  it("pasa al año siguiente si la fecha quedó atrás hace más de un mes", () => {
    expect(deducirFecha(3, 2, HOY)).toBe("2027-02-03");
  });

  it("acepta el 29 de febrero solo si el año lo tiene", () => {
    expect(deducirFecha(29, 2, "2027-11-01")).toBe("2028-02-29");
    expect(deducirFecha(29, 2, HOY)).toBeNull();
  });

  it("rechaza días y meses imposibles", () => {
    expect(deducirFecha(31, 4, HOY)).toBeNull();
    expect(deducirFecha(0, 5, HOY)).toBeNull();
    expect(deducirFecha(10, 13, HOY)).toBeNull();
  });
});

describe("ATAJOS_CADUCIDAD", () => {
  it("calcula cada chip desde hoy", () => {
    expect(ATAJOS_CADUCIDAD.map((a) => a.calcular(HOY))).toEqual([
      "2026-11-04",
      "2026-11-08",
      "2026-12-01",
      "2027-05-01",
      null,
    ]);
  });
});
