import { describe, expect, it } from "vitest";
import { diasDeSemana, escalar, lunesDe, necesidadesDelMenu, racionesACocinar, type FranjaPlan, type RecetaPlan } from "./menu.js";

describe("semanas", () => {
  it("encuentra el lunes de cualquier día", () => {
    expect(lunesDe("2026-11-01")).toBe("2026-10-26"); // domingo
    expect(lunesDe("2026-11-02")).toBe("2026-11-02"); // lunes
    expect(lunesDe("2026-11-05")).toBe("2026-11-02"); // jueves
    expect(lunesDe("2027-01-01")).toBe("2026-12-28"); // cruza el año
  });

  it("lista los siete días desde el lunes", () => {
    expect(diasDeSemana("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("escalar", () => {
  it("escala proporcionalmente a las raciones", () => {
    expect(escalar(400, 4, 2)).toBe(200);
    expect(escalar(300, 2, 3)).toBe(450);
    expect(escalar(1, 4, 4)).toBe(1);
  });
});

const franja = (id: string, extra: Partial<FranjaPlan> = {}): FranjaPlan => ({
  id,
  fecha: "2026-11-02",
  receta_id: "lentejas",
  raciones: 2,
  fuera_de_casa: false,
  es_sobra_de: null,
  cocinado: false,
  ...extra,
});

describe("racionesACocinar", () => {
  it("suma las raciones de las sobras a la franja que cocina", () => {
    const raciones = racionesACocinar([franja("lunes-cena"), franja("martes-comida", { es_sobra_de: "lunes-cena", raciones: 2 })]);
    expect(raciones).toEqual(new Map([["lunes-cena", 4]]));
  });

  it("ignora franjas fuera de casa, sin receta o ya cocinadas", () => {
    const raciones = racionesACocinar([
      franja("a", { fuera_de_casa: true }),
      franja("b", { receta_id: null }),
      franja("c", { cocinado: true }),
      franja("d"),
    ]);
    expect([...raciones.keys()]).toEqual(["d"]);
  });

  it("no suma sobras de quien está fuera de casa", () => {
    const raciones = racionesACocinar([franja("origen"), franja("sobra", { es_sobra_de: "origen", fuera_de_casa: true })]);
    expect(raciones.get("origen")).toBe(2);
  });
});

describe("necesidadesDelMenu", () => {
  const recetas = new Map<string, RecetaPlan>([
    [
      "lentejas",
      {
        raciones: 4,
        ingredientes: [
          { ingrediente_id: "lenteja", cantidad: 400, opcional: false },
          { ingrediente_id: "chorizo", cantidad: 200, opcional: false },
          { ingrediente_id: "pimenton", cantidad: 5, opcional: true },
        ],
      },
    ],
    ["tortilla", { raciones: 2, ingredientes: [{ ingrediente_id: "huevo", cantidad: 4, opcional: false }] }],
  ]);

  it("escala, acumula entre franjas y descarta opcionales", () => {
    const necesidades = necesidadesDelMenu(
      [
        franja("lun-comida", { raciones: 2 }),
        franja("mar-cena", { fecha: "2026-11-03", raciones: 4 }),
        franja("mie-cena", { fecha: "2026-11-04", receta_id: "tortilla", raciones: 3 }),
      ],
      recetas,
      "2026-11-02",
    );
    expect(necesidades).toEqual(
      new Map([
        ["lenteja", 600],
        ["chorizo", 300],
        ["huevo", 6],
      ]),
    );
  });

  it("no cuenta lo anterior a la fecha de inicio", () => {
    const necesidades = necesidadesDelMenu([franja("ayer", { fecha: "2026-11-01" }), franja("hoy")], recetas, "2026-11-02");
    expect(necesidades.get("lenteja")).toBe(200);
  });

  it("ignora recetas que ya no existen", () => {
    expect(necesidadesDelMenu([franja("x", { receta_id: "borrada" })], recetas, "2026-11-02").size).toBe(0);
  });
});
