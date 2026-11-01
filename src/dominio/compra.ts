export type OrigenAutomatico = "menu" | "stock_minimo";

export interface IngredienteCompra {
  id: string;
  siempre_disponible: boolean;
  stock_minimo: number | null;
}

export interface Faltante {
  ingrediente_id: string;
  cantidad: number;
  origen: OrigenAutomatico;
}

/** Suma lo que hay en la despensa por ingrediente (en unidad base). */
export function stockPorIngrediente(lotes: { ingrediente_id: string; cantidad: number }[]): Map<string, number> {
  const stock = new Map<string, number>();
  for (const l of lotes) stock.set(l.ingrediente_id, (stock.get(l.ingrediente_id) ?? 0) + l.cantidad);
  return stock;
}

/**
 * Lo que hay que comprar (§3.2 y §3.3): lo que pide el menú menos lo que hay, y lo necesario para que,
 * después de cocinar, quede el stock mínimo. Los básicos "siempre disponibles" nunca faltan.
 * `yaComprado`: cantidades ya marcadas como compradas en la lista y aún no guardadas en la despensa.
 */
export function calcularFaltantes(
  necesidades: Map<string, number>,
  stock: Map<string, number>,
  ingredientes: IngredienteCompra[],
  yaComprado: Map<string, number> = new Map(),
): Faltante[] {
  const faltantes: Faltante[] = [];
  for (const ing of ingredientes) {
    if (ing.siempre_disponible) continue;
    const necesario = necesidades.get(ing.id) ?? 0;
    const disponible = (stock.get(ing.id) ?? 0) + (yaComprado.get(ing.id) ?? 0);
    const faltaMenu = Math.max(0, necesario - disponible);
    const sobrante = Math.max(0, disponible - necesario);
    const faltaMinimo = Math.max(0, (ing.stock_minimo ?? 0) - sobrante);
    const cantidad = redondear(faltaMenu + faltaMinimo);
    if (cantidad > 0) faltantes.push({ ingrediente_id: ing.id, cantidad, origen: faltaMenu > 0 ? "menu" : "stock_minimo" });
  }
  return faltantes;
}

export interface ItemAutomatico {
  id: string;
  ingrediente_id: string;
  cantidad_base: number | null;
  origen: OrigenAutomatico;
}

export interface CambiosLista {
  crear: Faltante[];
  actualizar: { id: string; cantidad: number; origen: OrigenAutomatico }[];
  borrar: string[];
}

/**
 * Ajusta los elementos automáticos pendientes de la lista a lo que falta ahora.
 * No toca los manuales ni los ya marcados como comprados (esos entran en `yaComprado`).
 * `apuntadosAMano`: ingredientes que ya están en la lista como entrada manual pendiente; no se duplican.
 */
export function sincronizarAutomaticos(
  actuales: ItemAutomatico[],
  faltantes: Faltante[],
  apuntadosAMano: Set<string> = new Set(),
): CambiosLista {
  const porIngrediente = new Map(faltantes.filter((f) => !apuntadosAMano.has(f.ingrediente_id)).map((f) => [f.ingrediente_id, f]));
  const cambios: CambiosLista = { crear: [], actualizar: [], borrar: [] };
  const vistos = new Set<string>();

  for (const item of actuales) {
    const faltante = porIngrediente.get(item.ingrediente_id);
    if (!faltante || vistos.has(item.ingrediente_id)) {
      cambios.borrar.push(item.id);
      continue;
    }
    vistos.add(item.ingrediente_id);
    if (item.cantidad_base !== faltante.cantidad || item.origen !== faltante.origen) {
      cambios.actualizar.push({ id: item.id, cantidad: faltante.cantidad, origen: faltante.origen });
    }
  }
  for (const f of porIngrediente.values()) if (!vistos.has(f.ingrediente_id)) cambios.crear.push(f);
  return cambios;
}

export type UbicacionCompra = "nevera" | "congelador" | "despensa";

const SECCIONES_FRIO = ["Fruta y verdura", "Carnicería", "Pescadería", "Charcutería y quesos", "Lácteos y huevos"];

/** Dónde se guarda por defecto lo comprado según la sección del súper. */
export function ubicacionPorSeccion(seccion: string): UbicacionCompra {
  if (seccion === "Congelados") return "congelador";
  if (SECCIONES_FRIO.includes(seccion)) return "nevera";
  return "despensa";
}

/** Envases enteros que cubren una cantidad: 600 g con latas de 400 g → 2. */
export function envasesParaCubrir(cantidad: number | null, cantidadEnvase: number | null): number {
  if (!cantidad || !cantidadEnvase) return 1;
  return Math.max(1, Math.ceil(redondear(cantidad / cantidadEnvase)));
}

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}
