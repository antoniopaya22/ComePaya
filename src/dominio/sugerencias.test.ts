import { describe, expect, it } from "vitest";
import type { GrupoAlimento } from "./nutricion";
import { REGLAS_POR_DEFECTO } from "./nutricion";
import { puntuarRecetas, type ContextoSugerencia, type RecetaSugerible } from "./sugerencias";

const lentejas: RecetaSugerible = {
  id: "lentejas",
  nombre: "Lentejas con chorizo",
  raciones: 4,
  tiempo_prep_min: 10,
  tiempo_coccion_min: 45,
  valoracion: 5,
  ingredientes: [
    { ingrediente_id: "lenteja", cantidad: 400, opcional: false },
    { ingrediente_id: "chorizo", cantidad: 200, opcional: false },
    { ingrediente_id: "sal", cantidad: 5, opcional: false },
  ],
};
const tortilla: RecetaSugerible = {
  id: "tortilla",
  nombre: "Tortilla",
  raciones: 2,
  tiempo_prep_min: 10,
  tiempo_coccion_min: 15,
  valoracion: 3,
  ingredientes: [
    { ingrediente_id: "huevo", cantidad: 4, opcional: false },
    { ingrediente_id: "patata", cantidad: 400, opcional: false },
  ],
};
const asado: RecetaSugerible = {
  id: "asado",
  nombre: "Asado",
  raciones: 2,
  tiempo_prep_min: 30,
  tiempo_coccion_min: 90,
  valoracion: null,
  ingredientes: [{ ingrediente_id: "cordero", cantidad: 600, opcional: false }],
};

const contexto = (extra: Partial<ContextoSugerencia> = {}): ContextoSugerencia => ({
  fecha: "2026-11-03", // martes
  hoy: "2026-11-02",
  raciones: 2,
  stock: new Map([
    ["lenteja", 500],
    ["chorizo", 200],
    ["huevo", 2],
  ]),
  basicos: new Set(["sal"]),
  caducanPronto: new Map([["chorizo", { dias: 2, nombre: "Chorizo", fecha: "2026-11-05" }]]),
  gruposPorReceta: new Map<string, Set<GrupoAlimento>>([
    ["lentejas", new Set(["legumbre", "carne_roja"])],
    ["tortilla", new Set(["huevo"])],
    ["asado", new Set(["carne_roja"])],
  ]),
  cuentaGrupos: new Map(),
  reglas: REGLAS_POR_DEFECTO,
  ultimaVez: new Map(),
  rechazadas: new Set(),
  ...extra,
});

describe("puntuarRecetas", () => {
  it("prefiere lo que hay en casa, lo que caduca y lo que falta en la semana, y lo explica", () => {
    const [primera, ...resto] = puntuarRecetas([asado, tortilla, lentejas], contexto());
    expect(primera.receta_id).toBe("lentejas");
    // Ordenados por lo que más pesan: disponibilidad (×3), equilibrio (×2), caducidad (0,6 × 2), y a igual peso, lo positivo antes.
    expect(primera.motivos).toEqual([
      "Tienes todo en casa",
      "Esta semana no hay legumbres",
      "Usa chorizo, que caduca el jueves",
      "La valorasteis con 5 estrellas",
      "Lleva 55 min y es entre semana",
    ]);
    expect(resto.map((s) => s.receta_id)).toEqual(["tortilla", "asado"]);
  });

  it("los básicos siempre disponibles no cuentan como faltantes", () => {
    const [s] = puntuarRecetas([lentejas], contexto());
    expect(s.motivos[0]).toBe("Tienes todo en casa");
  });

  it("penaliza lo comido hace poco y lo que supera un máximo", () => {
    const ctx = contexto({ ultimaVez: new Map([["lentejas", "2026-10-31"]]), cuentaGrupos: new Map([["carne_roja", 2]]) });
    const [s] = puntuarRecetas([lentejas], ctx);
    expect(s.motivos).toContain("La comisteis hace 3 días");
    expect(s.motivos).toContain("Ya hay 2 comidas con carne roja esta semana");
    expect(s.puntos).toBeLessThan(puntuarRecetas([lentejas], contexto())[0].puntos);
  });

  it("valora lo rápido entre semana y lo elaborado en fin de semana", () => {
    expect(puntuarRecetas([tortilla], contexto())[0].motivos).toContain("Rápida: 25 min");
    expect(puntuarRecetas([asado], contexto({ fecha: "2026-11-07" }))[0].motivos).toContain("Elaborada, para el fin de semana");
  });

  it("no sugiere lo rechazado", () => {
    expect(puntuarRecetas([lentejas, tortilla], contexto({ rechazadas: new Set(["lentejas"]) })).map((s) => s.receta_id)).toEqual(["tortilla"]);
  });

  it("cuenta la disponibilidad parcial", () => {
    const [s] = puntuarRecetas([tortilla], contexto());
    expect(s.motivos).toContain("Faltan 2 ingredientes");
  });
});
