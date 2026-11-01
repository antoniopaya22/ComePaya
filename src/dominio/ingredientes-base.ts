import type { GrupoAlimento } from "./nutricion";
import { mismoNombre } from "./texto";
import type { UnidadBase } from "./unidades";

// Ingredientes habituales en una casa española para no empezar de cero.
// Caducidad por defecto (días, producto cerrado o fresco) y peso por unidad son orientativos y editables.
// No incluye valores nutricionales: se toman de los productos escaneados o se introducen a mano.

export interface IngredienteBase {
  nombre: string;
  unidad_base: UnidadBase;
  seccion_super: string;
  grupo_alimento: GrupoAlimento | null;
  caducidad_defecto_dias: number | null;
  peso_unidad_g: number | null;
  siempre_disponible: boolean;
  emoji: string;
  alergenos: string[];
  dias_tras_abrir: number | null;
}

type Fila = [nombre: string, unidad: UnidadBase, grupo: GrupoAlimento | null, caducidad: number | null, emoji: string, peso?: number, basico?: boolean];

const POR_SECCION: Record<string, Fila[]> = {
  "Fruta y verdura": [
    ["Tomate", "g", "verdura", 7, "🍅"],
    ["Cebolla", "g", "verdura", 30, "🧅"],
    ["Ajo", "ud", null, 60, "🧄", 5, true],
    ["Patata", "g", null, 30, "🥔"],
    ["Zanahoria", "g", "verdura", 21, "🥕"],
    ["Pimiento rojo", "g", "verdura", 10, "🫑"],
    ["Pimiento verde", "g", "verdura", 10, "🫑"],
    ["Calabacín", "g", "verdura", 10, "🥒"],
    ["Berenjena", "g", "verdura", 7, "🍆"],
    ["Lechuga", "ud", "verdura", 7, "🥬", 400],
    ["Espinacas", "g", "verdura", 5, "🥬"],
    ["Brócoli", "g", "verdura", 7, "🥦"],
    ["Coliflor", "g", "verdura", 7, "🥦"],
    ["Judías verdes", "g", "verdura", 5, "🫛"],
    ["Champiñones", "g", "verdura", 5, "🍄"],
    ["Puerro", "ud", "verdura", 14, "🥬", 150],
    ["Pepino", "ud", "verdura", 10, "🥒", 300],
    ["Calabaza", "g", "verdura", 30, "🎃"],
    ["Perejil", "g", null, 7, "🌿"],
    ["Aguacate", "ud", "fruta", 5, "🥑", 200],
    ["Limón", "ud", "fruta", 21, "🍋", 120],
    ["Naranja", "ud", "fruta", 21, "🍊", 200],
    ["Manzana", "ud", "fruta", 21, "🍎", 180],
    ["Plátano", "ud", "fruta", 6, "🍌", 120],
    ["Pera", "ud", "fruta", 10, "🍐", 180],
    ["Kiwi", "ud", "fruta", 14, "🥝", 90],
    ["Fresas", "g", "fruta", 4, "🍓"],
    ["Uvas", "g", "fruta", 7, "🍇"],
    ["Melocotón", "ud", "fruta", 5, "🍑", 150],
    ["Melón", "g", "fruta", 7, "🍈"],
  ],
  Panadería: [
    ["Pan", "g", "cereal", 3, "🥖"],
    ["Pan de molde", "g", "cereal", 10, "🍞"],
    ["Pan rallado", "g", "cereal", 180, "🍞"],
  ],
  Carnicería: [
    ["Pechuga de pollo", "g", "carne_blanca", 3, "🍗"],
    ["Muslos de pollo", "g", "carne_blanca", 3, "🍗"],
    ["Pavo", "g", "carne_blanca", 3, "🦃"],
    ["Conejo", "g", "carne_blanca", 3, "🐇"],
    ["Carne picada", "g", "carne_roja", 2, "🥩"],
    ["Filetes de ternera", "g", "carne_roja", 3, "🥩"],
    ["Lomo de cerdo", "g", "carne_roja", 3, "🥩"],
    ["Costillas de cerdo", "g", "carne_roja", 3, "🍖"],
    ["Cordero", "g", "carne_roja", 3, "🍖"],
    ["Hamburguesas", "g", "carne_roja", 3, "🍔"],
    ["Salchichas", "g", "ultraprocesado", 7, "🌭"],
  ],
  Pescadería: [
    ["Merluza", "g", "pescado", 2, "🐟"],
    ["Salmón", "g", "pescado", 2, "🐟"],
    ["Bacalao", "g", "pescado", 2, "🐟"],
    ["Dorada", "g", "pescado", 2, "🐟"],
    ["Lubina", "g", "pescado", 2, "🐟"],
    ["Sardinas", "g", "pescado", 2, "🐟"],
    ["Gambas", "g", "pescado", 2, "🦐"],
    ["Mejillones", "g", "pescado", 2, "🦪"],
    ["Calamares", "g", "pescado", 2, "🦑"],
  ],
  "Charcutería y quesos": [
    ["Jamón serrano", "g", "carne_roja", 30, "🥓"],
    ["Jamón cocido", "g", "carne_roja", 7, "🥓"],
    ["Chorizo", "g", "carne_roja", 30, "🌭"],
    ["Panceta", "g", "carne_roja", 14, "🥓"],
    ["Queso curado", "g", "lacteo", 30, "🧀"],
    ["Queso fresco", "g", "lacteo", 7, "🧀"],
    ["Queso rallado", "g", "lacteo", 30, "🧀"],
    ["Mozzarella", "g", "lacteo", 7, "🧀"],
  ],
  "Lácteos y huevos": [
    ["Huevo", "ud", "huevo", 21, "🥚", 60],
    ["Leche", "ml", "lacteo", null, "🥛"],
    ["Yogur natural", "ud", "lacteo", 21, "🥛", 125],
    ["Mantequilla", "g", "lacteo", 60, "🧈"],
    ["Nata para cocinar", "ml", "lacteo", 60, "🥛"],
  ],
  Despensa: [
    ["Aceite de oliva", "ml", null, null, "🫒", undefined, true],
    ["Sal", "g", null, null, "🧂", undefined, true],
    ["Pimienta negra", "g", null, null, "🌶️", undefined, true],
    ["Pimentón", "g", null, null, "🌶️", undefined, true],
    ["Comino", "g", null, null, "🌿", undefined, true],
    ["Orégano", "g", null, null, "🌿", undefined, true],
    ["Laurel", "ud", null, null, "🌿", 0.2, true],
    ["Vinagre", "ml", null, null, "🫗", undefined, true],
    ["Aceite de girasol", "ml", null, null, "🫗"],
    ["Arroz", "g", "cereal", null, "🍚"],
    ["Pasta", "g", "cereal", null, "🍝"],
    ["Espaguetis", "g", "cereal", null, "🍝"],
    ["Harina", "g", "cereal", null, "🌾"],
    ["Copos de avena", "g", "cereal", null, "🥣"],
    ["Cuscús", "g", "cereal", null, "🍚"],
    ["Lentejas", "g", "legumbre", null, "🫘"],
    ["Garbanzos", "g", "legumbre", null, "🫘"],
    ["Alubias", "g", "legumbre", null, "🫘"],
    ["Azúcar", "g", null, null, "🍬"],
    ["Caldo de pollo", "ml", null, null, "🍲"],
    ["Caldo de verduras", "ml", null, null, "🍲"],
    ["Frutos secos", "g", null, null, "🥜"],
    ["Miel", "g", null, null, "🍯"],
    ["Café", "g", null, null, "☕"],
    ["Galletas", "g", "ultraprocesado", null, "🍪"],
    ["Cereales de desayuno", "g", "ultraprocesado", null, "🥣"],
    ["Chocolate", "g", "ultraprocesado", null, "🍫"],
  ],
  Conservas: [
    ["Tomate triturado", "g", null, null, "🥫"],
    ["Tomate frito", "g", null, null, "🥫"],
    ["Atún en lata", "g", "pescado", null, "🥫"],
    ["Garbanzos cocidos", "g", "legumbre", null, "🫘"],
    ["Lentejas cocidas", "g", "legumbre", null, "🫘"],
    ["Maíz dulce", "g", null, null, "🌽"],
    ["Aceitunas", "g", null, null, "🫒"],
    ["Mayonesa", "g", "ultraprocesado", null, "🫙"],
  ],
  Bebidas: [
    ["Agua", "ml", null, null, "💧"],
    ["Zumo", "ml", null, null, "🧃"],
    ["Refresco", "ml", "ultraprocesado", null, "🥤"],
    ["Cerveza", "ml", null, null, "🍺"],
    ["Vino", "ml", null, null, "🍷"],
  ],
  Congelados: [
    ["Guisantes congelados", "g", "verdura", null, "🫛"],
    ["Verduras congeladas", "g", "verdura", null, "🥦"],
    ["Pizza congelada", "g", "ultraprocesado", null, "🍕"],
    ["Croquetas congeladas", "g", "ultraprocesado", null, "🧆"],
    ["Helado", "g", "ultraprocesado", null, "🍨"],
  ],
  Droguería: [
    ["Papel de cocina", "ud", null, null, "🧻"],
    ["Lavavajillas", "ml", null, null, "🧽"],
    ["Detergente", "ml", null, null, "🧺"],
  ],
  Higiene: [
    ["Papel higiénico", "ud", null, null, "🧻"],
    ["Gel de ducha", "ml", null, null, "🧴"],
    ["Pasta de dientes", "ud", null, null, "🪥"],
  ],
};

// Alérgenos habituales de cada ingrediente base (los productos concretos pueden traer más).
const ALERGENOS_BASE: Record<string, string[]> = {
  "en:gluten": ["Pan", "Pan de molde", "Pan rallado", "Pasta", "Espaguetis", "Harina", "Copos de avena", "Cuscús", "Galletas", "Cereales de desayuno", "Cerveza", "Croquetas congeladas", "Pizza congelada"],
  "en:milk": ["Leche", "Yogur natural", "Mantequilla", "Nata para cocinar", "Queso curado", "Queso fresco", "Queso rallado", "Mozzarella", "Helado", "Chocolate", "Pizza congelada", "Croquetas congeladas"],
  "en:eggs": ["Huevo", "Mayonesa"],
  "en:fish": ["Merluza", "Salmón", "Bacalao", "Dorada", "Lubina", "Sardinas", "Atún en lata"],
  "en:crustaceans": ["Gambas"],
  "en:molluscs": ["Mejillones", "Calamares"],
  "en:nuts": ["Frutos secos"],
  "en:sulphur-dioxide-and-sulphites": ["Vino", "Vinagre"],
};

// Días que aguanta en la nevera una vez abierto (orientativo).
const DIAS_TRAS_ABRIR: Record<string, number> = {
  Leche: 4,
  "Nata para cocinar": 4,
  "Tomate triturado": 4,
  "Tomate frito": 5,
  "Atún en lata": 2,
  "Garbanzos cocidos": 3,
  "Lentejas cocidas": 3,
  "Maíz dulce": 3,
  Zumo: 4,
  "Caldo de pollo": 4,
  "Caldo de verduras": 4,
  "Jamón cocido": 4,
  "Jamón serrano": 21,
  "Queso rallado": 14,
  Mozzarella: 3,
  "Pan de molde": 7,
  Mayonesa: 30,
  Aceitunas: 14,
};

export const INGREDIENTES_BASE: IngredienteBase[] = Object.entries(POR_SECCION).flatMap(([seccion, filas]) =>
  filas.map(([nombre, unidad, grupo, caducidad, emoji, peso, basico]) => ({
    nombre,
    unidad_base: unidad,
    seccion_super: seccion,
    grupo_alimento: grupo,
    caducidad_defecto_dias: caducidad,
    peso_unidad_g: peso ?? null,
    siempre_disponible: basico ?? false,
    emoji,
    alergenos: Object.entries(ALERGENOS_BASE)
      .filter(([, nombres]) => nombres.includes(nombre))
      .map(([alergeno]) => alergeno),
    dias_tras_abrir: DIAS_TRAS_ABRIR[nombre] ?? null,
  })),
);

/** Datos de partida de un ingrediente nuevo si su nombre coincide con uno de la lista base. */
export function datosBaseDe(nombre: string): Partial<Omit<IngredienteBase, "nombre">> {
  const base = INGREDIENTES_BASE.find((b) => mismoNombre(b.nombre, nombre));
  if (!base) return {};
  const { nombre: _nombre, ...datos } = base;
  return datos;
}

/** Los de la lista base que el hogar aún no tiene (comparando nombres sin tildes ni plurales). */
export function ingredientesBaseQueFaltan(existentes: { nombre: string }[]): IngredienteBase[] {
  return INGREDIENTES_BASE.filter((base) => !existentes.some((e) => mismoNombre(e.nombre, base.nombre)));
}

export const EMOJI_SECCION: Record<string, string> = {
  "Fruta y verdura": "🥬",
  Panadería: "🥖",
  Carnicería: "🥩",
  Pescadería: "🐟",
  "Charcutería y quesos": "🧀",
  "Lácteos y huevos": "🥛",
  Despensa: "🫙",
  Conservas: "🥫",
  Bebidas: "🧃",
  Congelados: "🧊",
  Droguería: "🧽",
  Higiene: "🧴",
};

/**
 * Icono de un ingrediente o de una entrada de la lista: el suyo; si no tiene, el de un ingrediente base
 * con el mismo nombre; si no, el de su sección.
 */
export function emojiPara(nombre: string, seccion: string | null, propio?: string | null): string {
  if (propio) return propio;
  const base = INGREDIENTES_BASE.find((b) => mismoNombre(b.nombre, nombre));
  return base?.emoji ?? (seccion ? EMOJI_SECCION[seccion] : undefined) ?? "🛒";
}
