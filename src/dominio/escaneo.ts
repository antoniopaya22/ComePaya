import { normalizar } from "./texto.js";

/**
 * Nombre de ingrediente propuesto a partir del nombre comercial: sin la marca, sin el formato
 * y sin cantidades. "Tomate triturado Hacendado 400 g" → "Tomate triturado".
 */
export function ingredienteSugerido(nombre: string, marca: string | null): string {
  const marcas = (marca ?? "")
    .split(/[,/]/)
    .map((m) => normalizar(m))
    .filter(Boolean);
  const palabras = nombre
    .replace(/\d+([.,]\d+)?\s*(kg|g|gr|l|ml|cl|ud|uds|x)\b/gi, " ")
    .replace(/\b(pack|bote|lata|botella|brick|bolsa|paquete|bandeja|garrafa|tarro|caja|frasco)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !marcas.some((m) => m.split(" ").includes(normalizar(p))));
  const limpio = palabras.join(" ").replace(/\s+([,.])/g, "$1").trim();
  const resultado = limpio || nombre.trim();
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

/**
 * Si al escanear hay que preguntar la caducidad (§7.2): siempre en nevera y congelador; en la despensa,
 * solo si el producto o su ingrediente suelen tener caducidad. Lo demás se añade directamente.
 */
export function preguntarCaducidad(ubicacion: "nevera" | "congelador" | "despensa", diasHabituales: number | null): boolean {
  return ubicacion !== "despensa" || diasHabituales !== null;
}
