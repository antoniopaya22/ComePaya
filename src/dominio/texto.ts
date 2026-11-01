/** Minúsculas, sin tildes y con los espacios colapsados: para comparar nombres escritos a mano. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formas en singular posibles de una palabra ya normalizada. El plural español añade "s" tras vocal
 * ("tomates" → "tomate") y "es" tras consonante ("limones" → "limon", "nueces" → "nuez"); sin diccionario
 * no se sabe cuál aplica, así que se prueban todas.
 */
function formasSingulares(palabra: string): string[] {
  const formas = [palabra];
  if (palabra.length > 3 && palabra.endsWith("s")) formas.push(palabra.slice(0, -1));
  if (palabra.length > 4 && palabra.endsWith("es")) formas.push(palabra.slice(0, -2));
  if (palabra.length > 4 && palabra.endsWith("ces")) formas.push(`${palabra.slice(0, -3)}z`);
  return formas;
}

/**
 * Puntuación de búsqueda (0 = no coincide): todas las palabras buscadas deben aparecer, sin tildes ni mayúsculas.
 * Pesa más que el nombre empiece por lo buscado, después que alguna palabra empiece, y después que solo lo contenga.
 */
export function puntuarBusqueda(nombre: string, busqueda: string, extra: string[] = []): number {
  const consulta = normalizar(busqueda);
  if (!consulta) return 1;
  const principal = normalizar(nombre);
  const todo = `${principal} ${normalizar(extra.join(" "))}`;
  const palabras = consulta.split(" ");
  if (!palabras.every((p) => todo.includes(p))) return 0;
  if (principal.startsWith(consulta)) return 1;
  if (principal.split(" ").some((p) => p.startsWith(palabras[0]))) return 0.8;
  if (principal.includes(consulta)) return 0.6;
  return 0.4;
}

/** Dos nombres son el mismo ignorando mayúsculas, tildes, espacios y plurales ("Limones" = "limón"). */
export function mismoNombre(a: string, b: string): boolean {
  const palabrasA = normalizar(a).split(" ");
  const palabrasB = normalizar(b).split(" ");
  if (!palabrasA[0] || palabrasA.length !== palabrasB.length) return false;
  return palabrasA.every((palabra, i) => {
    const formasB = formasSingulares(palabrasB[i]);
    return formasSingulares(palabra).some((forma) => formasB.includes(forma));
  });
}
