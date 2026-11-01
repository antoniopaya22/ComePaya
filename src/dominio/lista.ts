import { mismoNombre } from "./texto";

export const SECCION_OTROS = "Otros";

/** Orden por defecto si el hogar aún no ha configurado ninguna tienda. */
export const SECCIONES_POR_DEFECTO = [
  "Fruta y verdura",
  "Panadería",
  "Carnicería",
  "Pescadería",
  "Charcutería y quesos",
  "Lácteos y huevos",
  "Despensa",
  "Conservas",
  "Bebidas",
  "Congelados",
  "Droguería",
  "Higiene",
  SECCION_OTROS,
];

export interface ItemAgrupable {
  id: string;
  seccion_super: string;
  marcado: boolean;
  creado_en: string;
}

export interface GrupoSeccion<T> {
  seccion: string;
  items: T[];
  pendientes: number;
}

/**
 * Agrupa la lista por secciones en el orden de recorrido de la tienda (§4.2).
 * Las secciones que la tienda no conoce van detrás, por orden alfabético, y "Otros" siempre al final.
 * Dentro de cada sección: primero lo pendiente y después lo marcado, cada parte por orden de alta.
 */
export function agruparPorSeccion<T extends ItemAgrupable>(items: T[], ordenSecciones: string[]): GrupoSeccion<T>[] {
  const grupos = new Map<string, T[]>();
  for (const item of items) {
    const seccion = item.seccion_super?.trim() || SECCION_OTROS;
    const grupo = grupos.get(seccion);
    if (grupo) grupo.push(item);
    else grupos.set(seccion, [item]);
  }

  const posicion = new Map(ordenSecciones.map((s, i) => [s, i]));
  const peso = (seccion: string) =>
    seccion === SECCION_OTROS ? Number.POSITIVE_INFINITY : (posicion.get(seccion) ?? ordenSecciones.length);

  return [...grupos.entries()]
    .sort(([a], [b]) => peso(a) - peso(b) || a.localeCompare(b, "es"))
    .map(([seccion, itemsSeccion]) => ({
      seccion,
      items: [...itemsSeccion].sort(
        (a, b) => Number(a.marcado) - Number(b.marcado) || a.creado_en.localeCompare(b.creado_en),
      ),
      pendientes: itemsSeccion.filter((i) => !i.marcado).length,
    }));
}

export interface EntradaLista {
  texto: string;
  cantidad: string | null;
}

const UNIDAD = "(?:kg|g|gr|grs|l|ml|cl|ud|uds|unidades?|latas?|botes?|paquetes?|bolsas?|botellas?|docenas?|bandejas?)";
const CANTIDAD_DELANTE = new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${UNIDAD}?)\\s+(?:de\\s+)?(.+)$`, "i");
const CANTIDAD_DETRAS = new RegExp(`^(.+?)\\s+(?:x\\s*(\\d+(?:[.,]\\d+)?)|(\\d+(?:[.,]\\d+)?\\s*${UNIDAD}))$`, "i");

/**
 * Separa la cantidad del texto al añadir a mano: "2 kg de tomates" → ("Tomates", "2 kg"); "leche x6" → ("Leche", "x6").
 * Solo reconoce un número al principio (con unidad opcional) o "x N" / "N unidad" al final; lo demás es texto.
 */
export function parsearEntrada(entrada: string): EntradaLista {
  const limpio = entrada.replace(/\s+/g, " ").trim();
  const delante = CANTIDAD_DELANTE.exec(limpio);
  if (delante) return { cantidad: delante[1].replace(/\s+/g, " "), texto: capitalizar(delante[2]) };
  const detras = CANTIDAD_DETRAS.exec(limpio);
  if (detras) {
    return { texto: capitalizar(detras[1]), cantidad: detras[2] ? `x${detras[2]}` : detras[3].replace(/\s+/g, " ") };
  }
  return { texto: capitalizar(limpio), cantidad: null };
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface IngredienteBuscable {
  id: string;
  nombre: string;
  seccion_super: string;
}

/** Ingrediente que corresponde a un texto escrito a mano (sin tildes, mayúsculas ni plurales). */
export function buscarIngrediente<T extends IngredienteBuscable>(texto: string, ingredientes: T[]): T | null {
  return ingredientes.find((i) => mismoNombre(texto, i.nombre)) ?? null;
}

/** Lista pendiente como texto para mandar por WhatsApp o similar, por secciones. */
export function textoParaCompartir(grupos: GrupoSeccion<ItemAgrupable & { texto: string; cantidad: string | null }>[]): string {
  const secciones = grupos
    .map((g) => ({ seccion: g.seccion, items: g.items.filter((i) => !i.marcado) }))
    .filter((g) => g.items.length)
    .map((g) => [`*${g.seccion}*`, ...g.items.map((i) => `• ${i.texto}${i.cantidad ? ` (${i.cantidad})` : ""}`)].join("\n"));
  return secciones.length ? `🛒 Lista de la compra\n\n${secciones.join("\n\n")}` : "🛒 La lista de la compra está vacía";
}

/** "leche, dos kilos de tomates y pan" dictado → ["leche", "dos kilos de tomates", "pan"]. */
export function dividirDictado(texto: string): string[] {
  return texto
    .split(/\s*,\s*|\s+y\s+|\s+e\s+/i)
    .map((t) => t.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

/**
 * Lo que más se compra (por número de compras) y no está ya pendiente en la lista,
 * para añadirlo con un toque.
 */
export function habituales(compras: string[], pendientes: Set<string>, limite = 8): string[] {
  const cuenta = new Map<string, number>();
  for (const id of compras) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  return [...cuenta.entries()]
    .filter(([id, n]) => n >= 2 && !pendientes.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([id]) => id);
}

/** Secciones a ofrecer al elegir: las de la tienda en su orden, más las que ya usan los ingredientes. */
export function seccionesDisponibles(ordenTienda: string[], usadas: string[]): string[] {
  const base = ordenTienda.length ? ordenTienda : SECCIONES_POR_DEFECTO;
  const extra = usadas.filter((s) => s && !base.includes(s)).sort((a, b) => a.localeCompare(b, "es"));
  const todas = [...base.filter((s) => s !== SECCION_OTROS), ...new Set(extra)];
  return [...todas.filter((s) => s !== SECCION_OTROS), SECCION_OTROS];
}
