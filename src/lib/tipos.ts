import type { ParaFranja } from "@/dominio/bebe";
import type { FechaISO } from "@/dominio/caducidad";
import type { GrupoAlimento } from "@/dominio/nutricion";
import type { Nutrientes100, ProductoExterno } from "@/dominio/producto-externo";
import type { UnidadBase } from "@/dominio/unidades";

// Filas de las tablas de Supabase (ver supabase/migrations). Escritas a mano: no hay proyecto enlazado para generarlas.

export type Ubicacion = "nevera" | "congelador" | "despensa";

export const UBICACIONES: { valor: Ubicacion; etiqueta: string }[] = [
  { valor: "nevera", etiqueta: "Nevera" },
  { valor: "congelador", etiqueta: "Congelador" },
  { valor: "despensa", etiqueta: "Despensa" },
];

export interface Hogar {
  id: string;
  nombre: string;
  codigo_invitacion: string;
  /** Raciones por defecto de cada franja del menú. */
  comensales: number;
  aditivos_vigilados: string[];
  /** Alérgenos que afectan a alguien del hogar (etiquetas en:gluten…). */
  alergenos: string[];
  /** Secreto del feed iCal del menú. */
  ical_token: string | null;
  /** Nombre del bebé con menú propio (comida y cena); null si no hay. */
  bebe_nombre: string | null;
  creado_en: string;
}

export interface Miembro {
  hogar_id: string;
  user_id: string;
  nombre: string | null;
  email: string | null;
  rol: "admin" | "miembro";
  creado_en: string;
}

export interface Ingrediente {
  id: string;
  hogar_id: string;
  nombre: string;
  unidad_base: UnidadBase;
  seccion_super: string;
  grupo_alimento: GrupoAlimento | null;
  emoji: string | null;
  alergenos: string[];
  /** Días que aguanta abierto (producto abierto). */
  dias_tras_abrir: number | null;
  /** Medidas caseras en unidad base: {"cucharada": 8}. */
  equivalencias: Record<string, number> | null;
  /** Para calcular nutrientes de lo que se cuenta por unidades. */
  peso_unidad_g: number | null;
  nutrientes_100: Nutrientes100 | null;
  siempre_disponible: boolean;
  stock_minimo: number | null;
  caducidad_defecto_dias: number | null;
  /** Cuándo lo probó el bebé por primera vez; null si aún no. */
  bebe_introducido: FechaISO | null;
  creado_en: string;
}

export interface Producto {
  id: string;
  hogar_id: string;
  ingrediente_id: string;
  ean: string | null;
  nombre: string;
  marca: string | null;
  cantidad_envase: number | null;
  fuente: "openfoodfacts" | "mercadona" | "manual";
  foto_url: string | null;
  nutrientes_100: ProductoExterno["nutrientes_100"];
  nutriscore: ProductoExterno["nutriscore"];
  nova: ProductoExterno["nova"];
  niveles_nutrientes: ProductoExterno["niveles_nutrientes"];
  aditivos: string[] | null;
  alergenos: string[] | null;
  completitud_datos: number | null;
  mercadona_id: string | null;
  caducidad_habitual_dias: number | null;
  creado_en: string;
}

export interface ProductoConIngrediente extends Producto {
  ingrediente: Pick<Ingrediente, "id" | "nombre" | "unidad_base" | "caducidad_defecto_dias" | "emoji" | "seccion_super" | "dias_tras_abrir">;
}

export interface Lote {
  id: string;
  hogar_id: string;
  producto_id: string;
  cantidad: number;
  ubicacion: Ubicacion;
  fecha_caducidad: FechaISO | null;
  /** Si se ha abierto, desde cuándo. */
  abierto_en: FechaISO | null;
  creado_en: string;
}

export interface LoteConProducto extends Lote {
  producto: ProductoConIngrediente;
}

export interface Tienda {
  id: string;
  hogar_id: string;
  nombre: string;
  orden_secciones: string[];
  creado_en: string;
}

export interface ItemLista {
  id: string;
  hogar_id: string;
  texto: string;
  cantidad: string | null;
  /** Solo en los elementos generados por la app, en unidad base del ingrediente. */
  cantidad_base: number | null;
  ingrediente_id: string | null;
  seccion_super: string;
  marcado: boolean;
  origen: "manual" | "menu" | "stock_minimo";
  /** Súper donde se compra; null: en cualquiera. */
  tienda_id: string | null;
  creado_en: string;
}

export interface Receta {
  id: string;
  hogar_id: string;
  nombre: string;
  raciones: number;
  tiempo_prep_min: number | null;
  tiempo_coccion_min: number | null;
  preparacion_previa: string | null;
  preparacion_previa_horas: number | null;
  etiquetas: string[];
  valoracion: number | null;
  notas: string | null;
  foto_url: string | null;
  /** Web de la que se importó, si viene de una. */
  fuente_url: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface RecetaIngrediente {
  id: string;
  ingrediente_id: string;
  cantidad: number;
  opcional: boolean;
  orden: number;
  ingrediente: Pick<Ingrediente, "id" | "nombre" | "unidad_base">;
}

export interface PasoReceta {
  id: string;
  orden: number;
  texto: string;
  temporizador_seg: number | null;
  temporizador_nombre: string | null;
}

export interface RecetaCompleta extends Receta {
  ingredientes: RecetaIngrediente[];
  pasos: PasoReceta[];
}

export interface RacionCongelada {
  id: string;
  hogar_id: string;
  receta_id: string | null;
  descripcion: string;
  raciones: number;
  fecha_congelacion: FechaISO;
  creado_en: string;
}

export interface FranjaMenu {
  id: string;
  hogar_id: string;
  fecha: FechaISO;
  tipo: "comida" | "cena";
  para: ParaFranja;
  receta_id: string | null;
  raciones: number;
  fuera_de_casa: boolean;
  es_sobra_de: string | null;
  cocinado: boolean;
  creado_en: string;
}
