import webpush from "web-push";
import { sumarDias } from "../src/dominio/caducidad";
import { avisosCaducidad, avisosPreparacion, horaLocal, type Aviso, type FranjaAviso, type LoteAviso } from "../src/dominio/recordatorios";
import { json, rest, servidorConfigurado } from "./_lib/supabase-servidor";

interface Suscripcion {
  id: string;
  hogar_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * POST /api/recordatorios — lo llama pg_cron cada hora con la cabecera x-cron-secret (§4.6).
 * Calcula los avisos de preparación previa y de caducidad, y los manda por push a los dispositivos del hogar.
 */
export async function POST(request: Request): Promise<Response> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("x-cron-secret") !== secreto) return json({ error: "No autorizado" }, 401);
  if (!servidorConfigurado || !process.env.VAPID_PRIVATE_KEY || !process.env.VITE_VAPID_PUBLIC_KEY) {
    return json({ error: "Faltan SUPABASE_SECRET_KEY o las claves VAPID" }, 500);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:avisos@despensa.invalid", process.env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const ahora = new Date();
  const hoy = horaLocal(ahora).fecha;
  const [franjas, lotes] = await Promise.all([
    rest<FranjaAviso[]>(
      `franja_menu?select=id,hogar_id,fecha,tipo,fuera_de_casa,es_sobra_de,cocinado,receta:receta(id,nombre,preparacion_previa,preparacion_previa_horas)` +
        `&fecha=gte.${hoy}&fecha=lte.${sumarDias(hoy, 3)}&receta_id=not.is.null`,
    ),
    rest<{ hogar_id: string; fecha_caducidad: string; producto: { nombre: string } }[]>(
      `lote_despensa?select=hogar_id,fecha_caducidad,producto:producto(nombre)&fecha_caducidad=gte.${hoy}&fecha_caducidad=lte.${sumarDias(hoy, 2)}`,
    ),
  ]);
  const avisos: Aviso[] = [
    ...avisosPreparacion(franjas, ahora),
    ...avisosCaducidad(
      lotes.map((l): LoteAviso => ({ hogar_id: l.hogar_id, nombre: l.producto.nombre, fecha_caducidad: l.fecha_caducidad })),
      ahora,
    ),
  ];
  if (!avisos.length) return json({ enviados: 0 });

  const claves = avisos.map((a) => `"${a.clave}"`).join(",");
  const yaEnviados = new Set((await rest<{ clave: string }[]>(`aviso_enviado?select=clave&clave=in.(${claves})`)).map((a) => a.clave));
  const pendientes = avisos.filter((a) => !yaEnviados.has(a.clave));
  if (!pendientes.length) return json({ enviados: 0 });

  const hogares = [...new Set(pendientes.map((a) => a.hogar_id))].join(",");
  const suscripciones = await rest<Suscripcion[]>(`suscripcion_push?select=id,hogar_id,endpoint,p256dh,auth&hogar_id=in.(${hogares})`);

  let enviados = 0;
  const caducadas: string[] = [];
  for (const aviso of pendientes) {
    const destinos = suscripciones.filter((s) => s.hogar_id === aviso.hogar_id);
    await Promise.all(
      destinos.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: aviso.url, etiqueta: aviso.clave }),
            { TTL: 3600 },
          );
          enviados++;
        } catch (error) {
          // 404/410: el navegador ya no acepta esa suscripción.
          const estado = (error as { statusCode?: number }).statusCode;
          if (estado === 404 || estado === 410) caducadas.push(s.id);
          else console.error("Fallo enviando push", estado, error);
        }
      }),
    );
  }

  await rest("aviso_enviado", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: pendientes.map((a) => ({ clave: a.clave })) });
  if (caducadas.length) await rest(`suscripcion_push?id=in.(${caducadas.join(",")})`, { method: "DELETE" });
  return json({ avisos: pendientes.length, enviados });
}
