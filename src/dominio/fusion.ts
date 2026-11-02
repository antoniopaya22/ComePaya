import { puntuarBusqueda } from "./texto.js";
import type { UnidadBase } from "./unidades.js";

/**
 * Unir dos ingredientes que son lo mismo ("Gnochi" de una receta y los "Ñoquis" de la despensa):
 * todo lo del origen pasa al destino, con sus cantidades convertidas a la unidad del destino.
 */

/** Entre unidades y peso o volumen hace falta saber cuánto es una unidad. */
export function necesitaPesoUnidad(origen: UnidadBase, destino: UnidadBase): boolean {
  return (origen === "ud") !== (destino === "ud");
}

/**
 * Por cuánto se multiplica una cantidad del origen para pasarla a la unidad del destino.
 * g y ml se toman como equivalentes (aceite, leche… la diferencia no importa en casa).
 * `pesoUnidad`: gramos o mililitros de una unidad. null si hace falta y no se sabe.
 */
export function factorFusion(origen: UnidadBase, destino: UnidadBase, pesoUnidad: number | null): number | null {
  if (!necesitaPesoUnidad(origen, destino)) return 1;
  if (!pesoUnidad || pesoUnidad <= 0) return null;
  return origen === "ud" ? pesoUnidad : 1 / pesoUnidad;
}

/** Cantidad convertida, redondeada a milésimas y nunca cero (las recetas exigen cantidades positivas). */
export function convertir(cantidad: number, factor: number): number {
  return Math.max(0.001, Math.round(cantidad * factor * 1000) / 1000);
}

interface ProductoCandidato {
  id: string;
  nombre: string;
  marca: string | null;
  ingrediente_id: string;
  ingrediente: { nombre: string };
}

export interface Candidatos<P, I> {
  enCasa: P[];
  antes: P[];
  /** Ingredientes sin productos (los básicos que nunca se han comprado, por ejemplo). Solo al buscar. */
  otros: I[];
}

/**
 * Con qué se puede unir un ingrediente: primero lo que hay en casa, luego lo que se ha comprado alguna vez
 * y, al buscar, los ingredientes que no tienen productos. Sin el propio ingrediente ni sus productos.
 */
export function candidatosUnion<P extends ProductoCandidato, I extends { id: string; nombre: string }>(
  origenId: string,
  productos: P[],
  ingredientes: I[],
  stockPorProducto: Map<string, number>,
  busqueda: string,
): Candidatos<P, I> {
  const q = busqueda.trim();
  const puntuar = (nombre: string, extra: string[]) => (q ? puntuarBusqueda(nombre, q, extra) : 1);
  const productosValidos = productos
    .filter((p) => p.ingrediente_id !== origenId)
    .map((p) => [p, puntuar(p.nombre, [p.marca ?? "", p.ingrediente.nombre])] as const)
    .filter(([, puntos]) => puntos > 0)
    .sort((a, b) => b[1] - a[1] || a[0].nombre.localeCompare(b[0].nombre, "es"))
    .map(([p]) => p);
  const conProductos = new Set(productos.map((p) => p.ingrediente_id));
  const otros = q
    ? ingredientes
        .filter((i) => i.id !== origenId && !conProductos.has(i.id))
        .map((i) => [i, puntuarBusqueda(i.nombre, q)] as const)
        .filter(([, puntos]) => puntos > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([i]) => i)
    : [];
  return {
    enCasa: productosValidos.filter((p) => (stockPorProducto.get(p.id) ?? 0) > 0),
    antes: productosValidos.filter((p) => !(stockPorProducto.get(p.id) ?? 0)),
    otros,
  };
}
