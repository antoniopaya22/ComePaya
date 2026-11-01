import type { ProductoExterno } from "../../src/dominio/producto-externo";
import { rest, servidorConfigurado } from "./supabase-servidor";

// Caché compartida entre hogares (tabla catalogo_ean). Si falla, se sigue sin ella.

/** Pasado este tiempo se vuelve a consultar la fuente por si la ficha ha mejorado. */
const CADUCIDAD_CACHE_DIAS = 90;

type FilaCatalogo = Omit<ProductoExterno, "aditivos"> & { aditivos: string[] | null; actualizado: string; mercadona_id: string | null };

export async function leerCatalogo(ean: string): Promise<ProductoExterno | null> {
  if (!servidorConfigurado) return null;
  try {
    const [fila] = await rest<FilaCatalogo[]>(`catalogo_ean?ean=eq.${ean}&select=*`);
    if (!fila) return null;
    const antiguedad = (Date.now() - Date.parse(fila.actualizado)) / 86_400_000;
    if (fila.fuente === "openfoodfacts" && antiguedad > CADUCIDAD_CACHE_DIAS) return null;
    const { actualizado: _actualizado, mercadona_id: _mercadona, ...producto } = fila;
    return { ...producto, aditivos: fila.aditivos ?? [] };
  } catch (error) {
    console.error("No se ha podido leer catalogo_ean", error);
    return null;
  }
}

/** `sobrescribir: false` solo crea la ficha si no existía (para datos que no vienen de Open Food Facts). */
export async function guardarCatalogo(producto: ProductoExterno, mercadonaId?: string, { sobrescribir = true } = {}): Promise<void> {
  if (!servidorConfigurado) return;
  try {
    await rest("catalogo_ean?on_conflict=ean", {
      method: "POST",
      prefer: `resolution=${sobrescribir ? "merge" : "ignore"}-duplicates,return=minimal`,
      body: { ...producto, mercadona_id: mercadonaId ?? null, actualizado: new Date().toISOString() },
    });
  } catch (error) {
    console.error("No se ha podido guardar en catalogo_ean", error);
  }
}
