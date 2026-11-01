import { toast } from "sonner";
import { queryClient } from "./cache";

// El service worker nuevo toma el control en cuanto se instala (skipWaiting + clientsClaim), pero la página
// sigue con el código antiguo hasta que se recarga. En la app instalada no hay botón de recargar, así que
// se avisa y se ofrece hacerlo, y "tirar para recargar" carga la versión nueva si la hay.

let versionNueva = false;

/** Vigila si llega una versión nueva de la app; también la busca al volver a la app tras un rato fuera. */
export function vigilarActualizaciones() {
  if (!("serviceWorker" in navigator)) return;
  // Sin controlador es la primera instalación: no hay versión antigua que sustituir.
  const habiaVersion = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaVersion || versionNueva) return;
    versionNueva = true;
    toast("Hay una versión nueva de ComePayá", {
      duration: Infinity,
      action: { label: "Recargar", onClick: () => location.reload() },
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void buscarVersionNueva();
  });
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
