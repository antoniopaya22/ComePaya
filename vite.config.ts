/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// En producción Vercel despliega cada archivo de /api como una función.
// En desarrollo este plugin hace lo mismo: /api/producto?ean=… → export GET de api/producto.ts.
function apiEnDesarrollo(): Plugin {
  return {
    name: "api-en-desarrollo",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const ruta = url.pathname.replace(/^\/+|\/+$/g, "");
        if (!ruta || ruta.startsWith("_")) return next();
        try {
          const modulo = await server.ssrLoadModule(`/api/${ruta}.ts`);
          const handler = modulo[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end();
          }
          const cuerpo = req.method === "GET" || req.method === "HEAD" ? undefined : new Uint8Array(await leerCuerpo(req));
          const cabeceras = new Headers();
          for (const [clave, valor] of Object.entries(req.headers)) if (typeof valor === "string") cabeceras.set(clave, valor);
          const respuesta: Response = await handler(
            new Request(`http://localhost/api/${ruta}${url.search}`, { method: req.method, headers: cabeceras, body: cuerpo }),
          );
          res.statusCode = respuesta.status;
          respuesta.headers.forEach((valor, clave) => res.setHeader(clave, valor));
          res.end(Buffer.from(await respuesta.arrayBuffer()));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

function leerCuerpo(req: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const trozos: Buffer[] = [];
    req.on("data", (t: Buffer) => trozos.push(t));
    req.on("end", () => resolver(Buffer.concat(trozos)));
    req.on("error", rechazar);
  });
}

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"),
  },
  plugins: [
    react(),
    tailwindcss(),
    apiEnDesarrollo(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker propio (src/sw.ts) para poder recibir notificaciones push.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,wasm}"],
        // De las fuentes solo hace falta precargar el alfabeto latino.
        globIgnores: ["**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2"],
      },
      includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Despensa",
        short_name: "Despensa",
        description: "Despensa, lista de la compra y menú semanal del hogar",
        lang: "es",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f7f6f2",
        theme_color: "#2f6b4f",
        // Al mantener pulsado el icono de la app en Android.
        shortcuts: [
          { name: "Escanear", short_name: "Escanear", url: "/escanear", icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
          { name: "Lista de la compra", short_name: "Lista", url: "/lista", icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
          { name: "Menú de la semana", short_name: "Menú", url: "/menu", icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
        ],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "api/**/*.test.ts"],
  },
});
