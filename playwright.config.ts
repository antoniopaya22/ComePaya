import { defineConfig, devices } from "@playwright/test";

// Tests de pantalla contra el modo demo (Supabase simulada): no necesitan cuentas ni red.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5199",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
  },
  webServer: {
    command: "npm run dev:demo",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Los datos de ejemplo se fechan con el "hoy" del servidor: misma zona que el navegador,
    // o cerca de medianoche el servidor y la app no coinciden en qué día es hoy.
    env: { TZ: "Europe/Madrid" },
  },
});
