import { toast } from "sonner";
import { queryClient } from "./cache";

// El service worker nuevo toma el control en cuanto se instala (skipWaiting + clientsClaim), pero la página
// sigue con el código antiguo hasta que se recarga. En la app instalada no hay botón de recargar, así que
// se avisa y se ofrece hacerlo, y "tirar para recargar" carga la versión nueva si la hay.
// Mientras tanto, las pantallas que se descargan al abrirlas (escáner, modo cocina…) ya no existen en el
// servidor con su nombre antiguo: si fallan por eso, se recarga para pasar a la versión nueva.

let versionNueva = false;
const ARRANQUE = Date.now();
/** Si la versión nueva llega nada más abrir la app, se recarga sin preguntar: aún no se está haciendo nada. */
const RECIEN_ABIERTA_MS = 8_000;
const CLAVE_RECARGA = "comepaya.recarga-por-version";

/** Vigila si llega una versión nueva de la app; también la busca al volver a la app tras un rato fuera. */
export function vigilarActualizaciones() {
  // Vite avisa cuando no puede descargar una parte de la app (normalmente, porque es de una versión anterior).
  window.addEventListener("vite:preloadError", (evento) => {
    if (recargarPorVersion()) evento.preventDefault();
  });

  if (!("serviceWorker" in navigator)) return;
  // Sin controlador es la primera instalación: no hay versión antigua que sustituir.
  const habiaVersion = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaVersion || versionNueva) return;
    versionNueva = true;
    if (Date.now() - ARRANQUE < RECIEN_ABIERTA_MS && recargarPorVersion()) return;
    toast("Hay una versión nueva de ComePayá", {
      duration: Infinity,
      action: { label: "Recargar", onClick: () => location.reload() },
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void buscarVersionNueva();
  });
}

/** Error al descargar una parte de la app: se arregla recargando. */
export function esErrorDeCarga(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Unable to preload|Failed to load module script/i.test(mensaje);
}

/**
 * Recarga para pasar a la versión nueva, salvo que se haya hecho hace muy poco (si el fallo sigue tras
 * recargar, no es de versión y se entraría en un bucle). Devuelve si ha recargado.
 */
export function recargarPorVersion(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
    if (Date.now() - ultima < 30_000) return false;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

async function buscarVersionNueva() {
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    await registro?.update();
  } catch {
    // Sin conexión no se puede comprobar; ya se hará.
  }
}

/** Recarga: la versión nueva si la hay; si no, vuelve a pedir los datos de la pantalla. */
export async function recargar() {
  await buscarVersionNueva();
  if (versionNueva) {
    location.reload();
    return;
  }
  await Promise.all([queryClient.refetchQueries({ type: "active" }), new Promise((r) => setTimeout(r, 500))]);
}
