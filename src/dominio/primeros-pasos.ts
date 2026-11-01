/** Lo que ya se ha hecho en el hogar, para saber qué primeros pasos quedan. */
export interface EstadoHogar {
  lotes: number;
  recetas: number;
  franjasConReceta: number;
  itemsLista: number;
  miembros: number;
  avisosActivos: boolean;
}

export type IdPaso = "despensa" | "receta" | "menu" | "lista" | "familia" | "avisos";

export interface Paso {
  id: IdPaso;
  titulo: string;
  detalle: string;
  hecho: boolean;
}

/**
 * Primeros pasos para empezar a sacarle partido a la app, en el orden en que tiene sentido hacerlos.
 * `avisosPosibles` es falso si el dispositivo no admite notificaciones: ese paso no se muestra.
 */
export function primerosPasos(estado: EstadoHogar, avisosPosibles = true): Paso[] {
  const pasos: Paso[] = [
    {
      id: "despensa",
      titulo: "Añade lo que tienes en casa",
      detalle: "Escanea unos cuantos productos de la nevera o la despensa.",
      hecho: estado.lotes > 0,
    },
    {
      id: "receta",
      titulo: "Guarda una receta",
      detalle: "Escríbela o impórtala desde su web.",
      hecho: estado.recetas > 0,
    },
    {
      id: "menu",
      titulo: "Planifica una comida",
      detalle: "Pon un plato en el menú de la semana.",
      hecho: estado.franjasConReceta > 0,
    },
    {
      id: "lista",
      titulo: "Haz la lista de la compra",
      detalle: "Apunta algo o complétala desde el menú.",
      hecho: estado.itemsLista > 0,
    },
    {
      id: "familia",
      titulo: "Invita a tu familia",
      detalle: "Comparte el código del hogar para ver lo mismo.",
      hecho: estado.miembros > 1,
    },
    {
      id: "avisos",
      titulo: "Activa los avisos",
      detalle: "Te avisa de lo que caduca y de qué descongelar.",
      hecho: estado.avisosActivos,
    },
  ];
  return avisosPosibles ? pasos : pasos.filter((p) => p.id !== "avisos");
}

/** Proporción completada, de 0 a 1. */
export function progreso(pasos: Paso[]): number {
  return pasos.length ? pasos.filter((p) => p.hecho).length / pasos.length : 1;
}
