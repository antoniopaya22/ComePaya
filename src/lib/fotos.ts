import { supabase } from "./supabase";

const LADO_MAXIMO = 1400;

/**
 * Reduce una foto en el propio móvil (las de la cámara pesan varios MB) y la sube al bucket "fotos"
 * en la carpeta del hogar. Devuelve su URL pública.
 */
export async function subirFoto(hogarId: string, archivo: File): Promise<string> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  const blob = await new Promise<Blob>((resolver, rechazar) =>
    lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error("No se ha podido procesar la foto"))), "image/jpeg", 0.82),
  );

  const ruta = `${hogarId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("fotos").upload(ruta, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
}

/**
 * Borra una foto subida por la app (las de Open Food Facts, Mercadona o una web no se tocan). El Storage gratuito
 * es de 1 GB: las fotos que se cambian o de recetas borradas no deben quedarse. Si falla, no pasa nada grave.
 */
export async function borrarFoto(url: string | null | undefined): Promise<void> {
  const ruta = url && /\/storage\/v1\/object\/public\/fotos\/(.+)$/.exec(url.split("?")[0])?.[1];
  if (!ruta) return;
  const { error } = await supabase.storage.from("fotos").remove([decodeURIComponent(ruta)]);
  if (error) console.warn("No se ha podido borrar la foto", error);
}
