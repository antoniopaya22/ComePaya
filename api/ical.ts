import { sumarDias } from "../src/dominio/caducidad.js";
import { generarIcal, type FranjaIcal } from "../src/dominio/ical.js";
import { horaLocal } from "../src/dominio/recordatorios.js";
import { json, rest, servidorConfigurado } from "./_lib/supabase-servidor.js";

/**
 * GET /api/ical?token=… — menú del hogar como calendario suscribible (§4.4).
 * El token es secreto y propio de cada hogar (Ajustes); da acceso de solo lectura al menú.
 */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{32,80}$/.test(token)) return json({ error: "Token no válido" }, 400);
  if (!servidorConfigurado) return json({ error: "Falta SUPABASE_SECRET_KEY en el servidor" }, 500);

  const [hogar] = await rest<{ id: string; nombre: string; bebe_nombre: string | null }[]>(`hogar?select=id,nombre,bebe_nombre&ical_token=eq.${token}`);
  if (!hogar) return json({ error: "No existe" }, 404);

  const hoy = horaLocal(new Date()).fecha;
  const franjas = await rest<FranjaIcal[]>(
    `franja_menu?select=id,fecha,tipo,para,fuera_de_casa,es_sobra_de,receta:receta(nombre)&hogar_id=eq.${hogar.id}` +
      `&fecha=gte.${sumarDias(hoy, -14)}&fecha=lte.${sumarDias(hoy, 35)}&order=fecha`,
  );
  return new Response(generarIcal(hogar.nombre, franjas, new Date(), hogar.bebe_nombre), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}
