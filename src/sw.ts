/// <reference lib="webworker" />
// Service worker de la PWA: precarga la app para funcionar sin conexión y muestra las notificaciones push.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }));

interface DatosPush {
  titulo: string;
  cuerpo: string;
  url?: string;
  etiqueta?: string;
}

self.addEventListener("push", (evento) => {
  const datos = (evento.data?.json() ?? { titulo: "Despensa", cuerpo: "" }) as DatosPush;
  evento.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      tag: datos.etiqueta,
      lang: "es",
      data: { url: datos.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = (evento.notification.data as { url?: string } | null)?.url ?? "/";
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const abierta = ventanas[0] as WindowClient | undefined;
      if (abierta) {
        await abierta.focus();
        await abierta.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
