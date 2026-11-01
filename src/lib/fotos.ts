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
