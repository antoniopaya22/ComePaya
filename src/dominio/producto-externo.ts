/** Producto encontrado por EAN en una fuente externa, ya normalizado (forma de `catalogo_ean`). */
export interface ProductoExterno {
  ean: string;
  nombre: string | null;
  marca: string | null;
  cantidad_texto: string | null;
  /** Contenido del envase en g o ml, si la fuente lo da. */
  cantidad_envase: number | null;
  unidad_envase: "g" | "ml" | null;
  foto_url: string | null;
  nutrientes_100: Nutrientes100 | null;
  nutriscore: "a" | "b" | "c" | "d" | "e" | null;
  nova: 1 | 2 | 3 | 4 | null;
  niveles_nutrientes: Partial<Record<"grasa" | "saturadas" | "azucares" | "sal", NivelNutriente>> | null;
  aditivos: string[];
  /** 0–1: proporción de datos clave presentes. Por debajo de ~0,6 no se debe dar valoración (§8.1). */
  completitud_datos: number;
  fuente: "openfoodfacts" | "mercadona";
}

export interface Nutrientes100 {
  kcal?: number;
  grasa?: number;
  saturadas?: number;
  hidratos?: number;
  azucares?: number;
  fibra?: number;
  proteina?: number;
  sal?: number;
}

export type NivelNutriente = "bajo" | "moderado" | "alto";

export const EAN_VALIDO = /^[0-9]{8,14}$/;
