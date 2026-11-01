import { supabase } from "@/lib/supabase";

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const avisosDisponibles = Boolean(CLAVE_PUBLICA) && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function claveABytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const binario = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!avisosDisponibles) return null;
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

/** Pide permiso y registra este dispositivo para recibir los avisos del hogar. */
export async function activarAvisos(hogarId: string): Promise<void> {
  if (!avisosDisponibles) throw new Error("Este navegador no admite notificaciones");
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") throw new Error("No has dado permiso para las notificaciones");
  const registro = await navigator.serviceWorker.ready;
  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(CLAVE_PUBLICA!) }));
  const { endpoint, keys } = suscripcion.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase
    .from("suscripcion_push")
    .upsert({ hogar_id: hogarId, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function desactivarAvisos(): Promise<void> {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return;
  await supabase.from("suscripcion_push").delete().eq("endpoint", suscripcion.endpoint);
  await suscripcion.unsubscribe();
}
