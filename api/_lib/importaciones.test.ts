import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Vercel ejecuta cada función de /api con Node en modo ES modules ("type": "module") sin empaquetar:
// Node solo encuentra los imports relativos si llevan la extensión ("./caducidad.js"). Sin ella, la
// función se cae al arrancar (FUNCTION_INVOCATION_FAILED) aunque en desarrollo y en los tests funcione.

const RAIZ = resolve(__dirname, "../..");
const IMPORT = /(?:import|export)[^"';]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** Todos los archivos que acaba cargando alguna función de /api, con sus imports relativos. */
function grafoDeLaApi(): Map<string, string[]> {
  const grafo = new Map<string, string[]>();
  const pendientes = readdirSync(join(RAIZ, "api"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(RAIZ, "api", f));
  while (pendientes.length) {
    const archivo = pendientes.pop()!;
    if (grafo.has(archivo)) continue;
    const relativos = [...readFileSync(archivo, "utf8").matchAll(IMPORT)].map((m) => m[1] ?? m[2]).filter((s) => s.startsWith(".") || s.startsWith("@/"));
    grafo.set(archivo, relativos);
    for (const s of relativos) if (s.startsWith(".")) pendientes.push(resolve(dirname(archivo), `${s.replace(/\.js$/, "")}.ts`));
  }
  return grafo;
}

describe("funciones de /api en Vercel", () => {
  const grafo = grafoDeLaApi();

  it("recorre las funciones y lo que importan", () => {
    expect([...grafo.keys()].some((f) => f.endsWith("producto.ts"))).toBe(true);
    expect([...grafo.keys()].some((f) => f.includes("dominio"))).toBe(true);
  });

  it("los imports relativos llevan extensión .js y no usan el alias @/", () => {
    const malos = [...grafo].flatMap(([archivo, imports]) =>
      imports.filter((s) => s.startsWith("@/") || !s.endsWith(".js")).map((s) => `${archivo.slice(RAIZ.length + 1)} → ${s}`),
    );
    expect(malos).toEqual([]);
  });
});
