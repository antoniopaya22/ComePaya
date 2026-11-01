import { supabase, supabaseConfigurado } from "./supabase";

/** Versión desplegada (commit de Vercel) para saber en qué versión ocurrió un error. */
export const VERSION = __VERSION__;
export const REPOSITORIO = "https://github.com/antoniopaya22/ComePaya";

const recientes: { mensaje: string; momento: string }[] = [];
let enviados = 0;
const MAXIMO_POR_SESION = 20;

/**
 * Guarda un error del navegador en la tabla error_cliente (cada usuario solo ve los suyos).
 * Nunca lanza: si falla al registrar, se ignora para no provocar más errores.
 */
export function registrarError(error: unknown, contexto?: string) {
  const mensaje = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  // Ruido conocido: cortes de red y navegaciones canceladas.
  if (/Failed to fetch|NetworkError|Load failed|AbortError|ResizeObserver loop/i.test(mensaje)) return;
  recientes.unshift({ mensaje, momento: new Date().toISOString() });
  recientes.length = Math.min(recientes.length, 5);
  if (!supabaseConfigurado || enviados >= MAXIMO_POR_SESION) return;
  enviados++;
  void supabase
    .from("error_cliente")
    .insert({
      mensaje,
      pila: error instanceof Error ? (error.stack ?? null)?.slice(0, 4000) : null,
      contexto: contexto ?? null,
      ruta: location.pathname,
      version: VERSION,
      agente: navigator.userAgent.slice(0, 300),
    })
    .then(
      () => {},
      () => {},
    );
}

export function instalarCapturaDeErrores() {
  window.addEventListener("error", (e) => registrarError(e.error ?? e.message, "window.error"));
  window.addEventListener("unhandledrejection", (e) => registrarError(e.reason, "promesa sin capturar"));
}

/** URL para abrir un issue en GitHub con los datos útiles ya rellenos. */
export function urlReportarProblema(descripcion = ""): string {
  const cuerpo = [
    "### Qué ha pasado",
    descripcion || "<!-- Cuéntalo con tus palabras: qué hacías, qué esperabas y qué ha pasado -->",
    "",
    "### Datos",
    `- Versión: ${VERSION}`,
    `- Pantalla: ${location.pathname}`,
    `- Navegador: ${navigator.userAgent}`,
    recientes.length ? `- Últimos errores:\n${recientes.map((r) => `  - ${r.momento}: ${r.mensaje}`).join("\n")}` : "",
  ].join("\n");
  return `${REPOSITORIO}/issues/new?${new URLSearchParams({ title: "Problema: ", body: cuerpo, labels: "bug" })}`;
}
