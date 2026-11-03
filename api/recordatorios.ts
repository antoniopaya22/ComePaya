import webpush from "web-push";
import { sumarDias } from "../src/dominio/caducidad.js";
import { avisosCaducidad, avisosPreparacion, horaLocal, type Aviso, type FranjaAviso, type LoteAviso } from "../src/dominio/recordatorios.js";
import { json, rest, restTodas, servidorConfigurado } from "./_lib/supabase-servidor.js";

interface Suscripcion {
  id: string;
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
    restTodas<FranjaAviso>(
      `franja_menu?select=id,hogar_id,fecha,tipo,fuera_de_casa,es_sobra_de,cocinado,receta:receta(id,nombre,preparacion_previa,preparacion_previa_horas)` +
        `&fecha=gte.${hoy}&fecha=lte.${sumarDias(hoy, 3)}&receta_id=not.is.null&order=id`,
    ),
    restTodas<{ hogar_id: string; fecha_caducidad: string; producto: { nombre: string } }>(
      `lote_despensa?select=hogar_id,fecha_caducidad,producto:producto(nombre)&fecha_caducidad=gte.${hoy}&fecha_caducidad=lte.${sumarDias(hoy, 2)}&order=id`,
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

  // Se reservan antes de enviar: solo se mandan los que se acaban de registrar (no se repiten si la función
  // se corta a medias o hay dos ejecuciones a la vez).
  const pendientes = (
    await rest<{ clave: string }[]>("aviso_enviado?on_conflict=clave", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=representation",
      body: avisos.map((a) => ({ clave: a.clave })),
    })
  )
    .map((r) => avisos.find((a) => a.clave === r.clave)!)
    .filter(Boolean);
  if (!pendientes.length) return json({ enviados: 0 });

  // A los dispositivos de todos los miembros del hogar (aunque los activaran con otro hogar elegido).
  const hogares = [...new Set(pendientes.map((a) => a.hogar_id))].join(",");
  const miembros = await rest<{ hogar_id: string; user_id: string }[]>(`miembro?select=hogar_id,user_id&hogar_id=in.(${hogares})`);
  const usuarios = [...new Set(miembros.map((m) => m.user_id))];
  const suscripciones = usuarios.length
    ? await rest<(Suscripcion & { user_id: string })[]>(`suscripcion_push?select=id,user_id,endpoint,p256dh,auth&user_id=in.(${usuarios.join(",")})`)
    : [];

  let enviados = 0;
  const caducadas: string[] = [];
  const sinEntregar: string[] = [];
  for (const aviso of pendientes) {
    const deHogar = new Set(miembros.filter((m) => m.hogar_id === aviso.hogar_id).map((m) => m.user_id));
    const destinos = suscripciones.filter((s) => deHogar.has(s.user_id));
    let entregados = 0;
    await Promise.all(
      destinos.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: aviso.url, etiqueta: aviso.clave }),
            { TTL: 3600 },
          );
          entregados++;
        } catch (error) {
          // 404/410: el navegador ya no acepta esa suscripción.
          const estado = (error as { statusCode?: number }).statusCode;
          if (estado === 404 || estado === 410) caducadas.push(s.id);
          else console.error("Fallo enviando push", estado, error);
        }
      }),
    );
    enviados += entregados;
    // Si había a quién enviarlo y no llegó a ningún dispositivo (fallo temporal), se libera para reintentar.
    if (destinos.length && !entregados) sinEntregar.push(aviso.clave);
  }

  if (sinEntregar.length) await rest(`aviso_enviado?clave=in.(${sinEntregar.map((c) => `"${c}"`).join(",")})`, { method: "DELETE" });
  if (caducadas.length) await rest(`suscripcion_push?id=in.(${[...new Set(caducadas)].join(",")})`, { method: "DELETE" });
  return json({ avisos: pendientes.length, enviados });
}
