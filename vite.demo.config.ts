// Modo demo: la app completa contra una Supabase simulada en memoria (demo/servidor.ts).
// npm run dev:demo → http://localhost:5199 · también lo usan los tests de pantalla (Playwright).
import { defineConfig, mergeConfig } from "vite";
import { supabaseDemo } from "./demo/servidor";
import base from "./vite.config";

export default mergeConfig(
  base,
  defineConfig({
    mode: "demo",
    plugins: [supabaseDemo()],
    server: { port: 5199, strictPort: true },
  }),
);
