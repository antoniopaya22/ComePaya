/// <reference lib="webworker" />
// Service worker de la PWA: precarga la app para funcionar sin conexión y muestra las notificaciones push.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }));

// Motor del escáner en WebAssembly (iPhone): se guarda la primera vez que se usa, para escanear después sin red.
// El nombre lleva un hash, así que una versión nueva es otra entrada y la antigua caduca sola.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith(".wasm"),
  new CacheFirst({
    cacheName: "escaner",
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 2 })],
  }),
);

// Fotos de productos y recetas (Open Food Facts, Mercadona, Supabase Storage) y avatares: se guardan
// al verlas para que la despensa y el recetario se vean igual sin conexión y no se descarguen otra vez.
// Se piden con CORS para guardar la respuesta real: una opaca ocupa megas de cuota aunque la foto pese poco.
// Si el servidor no admite CORS, la foto se muestra igualmente pero no se guarda.
registerRoute(
  ({ request, url }) => request.destination === "image" && url.origin !== self.location.origin,
  new CacheFirst({
    cacheName: "fotos",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 24 * 60 * 60, purgeOnQuotaError: true }),
      {
        requestWillFetch: async ({ request }) => new Request(request.url, { mode: "cors", credentials: "omit" }),
        handlerDidError: async ({ request }) => fetch(request.url, { mode: "no-cors" }).catch(() => undefined),
      },
    ],
  }),
);

interface DatosPush {
  titulo: string;
  cuerpo: string;
  url?: string;
  etiqueta?: string;
}

self.addEventListener("push", (evento) => {
  const datos = (evento.data?.json() ?? { titulo: "ComePayá", cuerpo: "" }) as DatosPush;
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
