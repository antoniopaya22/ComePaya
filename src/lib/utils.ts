import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases));
}

/** Mensaje legible en español de un error de Supabase, de la red o de JavaScript (el detalle técnico queda en la consola). */
export function mensajeError(error: unknown): string {
  if (!(error && typeof error === "object" && "message" in error && typeof error.message === "string")) return "Algo ha fallado";
  const mensaje = error.message;
  const codigo = "code" in error ? String(error.code) : "";
  const traducido = traducirError(mensaje, codigo);
  if (traducido !== mensaje) console.warn("Error original:", error);
  return traducido;
}

function traducirError(mensaje: string, codigo: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("violates foreign key constraint") || codigo === "23503") return "Está en uso y no se puede borrar";
  if (m.includes("duplicate key") || codigo === "23505") return "Ya existe uno con ese nombre";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed") || m.includes("network request failed")) {
    return "Sin conexión: inténtalo cuando vuelva la red";
  }
  if (m.includes("jwt expired") || m.includes("invalid jwt") || m.includes("refresh token") || codigo === "PGRST301") {
    return "La sesión ha caducado: vuelve a entrar";
  }
  if (m.includes("row-level security") || codigo === "42501") return "No tienes permiso para hacer esto en este hogar";
  if (m.includes("timeout") || m.includes("timed out") || codigo === "57014") return "Ha tardado demasiado: inténtalo otra vez";
  if (m.includes("violates check constraint") || codigo === "23514") return "Algún valor no es válido";
  if (m.includes("could not find the function") || codigo === "PGRST202") return "La app se está actualizando: recarga en un momento";
  return mensaje;
}
