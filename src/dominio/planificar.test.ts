import { describe, expect, it } from "vitest";
import { REGLAS_POR_DEFECTO, type GrupoAlimento } from "./nutricion";
import { planificarSemana, type ContextoSemana } from "./planificar";
import type { RecetaSugerible } from "./sugerencias";

const receta = (id: string, ingredientes: [string, number][], extra: Partial<RecetaSugerible> = {}): RecetaSugerible => ({
  id,
  nombre: id,
  raciones: 2,
  tiempo_prep_min: 10,
  tiempo_coccion_min: 20,
  valoracion: 4,
  ingredientes: ingredientes.map(([ingrediente_id, cantidad]) => ({ ingrediente_id, cantidad, opcional: false })),
  ...extra,
});

const lentejas = receta("lentejas", [["lenteja", 200], ["chorizo", 100]]);
const merluza = receta("merluza", [["merluza", 300]]);
const tortilla = receta("tortilla", [["huevo", 4]]);

const base = (extra: Partial<ContextoSemana> = {}): ContextoSemana => ({
  hoy: "2026-11-02",
  stock: new Map([
    ["lenteja", 1000],
    ["chorizo", 100],
    ["huevo", 6],
  ]),
  basicos: new Set(),
  caducanPronto: new Map([["chorizo", { dias: 0, nombre: "Chorizo", fecha: "2026-11-03" }]]),
  gruposPorReceta: new Map<string, Set<GrupoAlimento>>([
    ["lentejas", new Set(["legumbre"])],
    ["merluza", new Set(["pescado"])],
    ["tortilla", new Set(["huevo"])],
  ]),
  cuentaGrupos: new Map(),
  reglas: REGLAS_POR_DEFECTO,
  ultimaVez: new Map(),
  rechazadas: new Set(),
  ...extra,
});

const huecos = [
  { fecha: "2026-11-03", tipo: "cena" as const, raciones: 2 },
  { fecha: "2026-11-03", tipo: "comida" as const, raciones: 2 },
  { fecha: "2026-11-04", tipo: "comida" as const, raciones: 2 },
];

describe("planificarSemana", () => {
  it("rellena en orden (comida antes que cena) y no repite plato", () => {
    const plan = planificarSemana(huecos, [lentejas, merluza, tortilla], base());
    expect(plan.map((p) => `${p.fecha} ${p.tipo}`)).toEqual(["2026-11-03 comida", "2026-11-03 cena", "2026-11-04 comida"]);
    expect(new Set(plan.map((p) => p.receta_id)).size).toBe(3);
  });

  it("empieza por lo que caduca y descuenta lo que ya ha gastado", () => {
    const plan = planificarSemana(huecos.slice(0, 2), [lentejas, merluza, tortilla], base());
    // El primer hueco usa el chorizo que caduca; el segundo ya no cuenta con ese chorizo.
    expect(plan[0].receta_id).toBe("lentejas");
    expect(plan[0].motivos.join(" ")).toMatch(/chorizo/);
  });

  it("cubre los grupos que faltan en la semana", () => {
    const plan = planificarSemana([huecos[0]], [tortilla, merluza], base({ caducanPronto: new Map(), stock: new Map([["huevo", 6], ["merluza", 300]]) }));
    expect(plan[0].receta_id).toBe("merluza");
    expect(plan[0].motivos).toContain("Esta semana no hay pescado");
  });

  it("sin recetas no propone nada", () => {
    expect(planificarSemana(huecos, [], base())).toEqual([]);
  });

  it("ignora caducidades que ya habrán pasado el día del hueco", () => {
    const plan = planificarSemana([{ fecha: "2026-11-10", tipo: "comida", raciones: 2 }], [lentejas], base());
    expect(plan[0].motivos.join(" ")).not.toMatch(/caduca/);
  });
});
