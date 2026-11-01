import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases));
}

/** Mensaje legible de un error de Supabase o de JavaScript. */
export function mensajeError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    if (error.message.includes("violates foreign key constraint")) return "Está en uso y no se puede borrar";
    if (error.message.includes("duplicate key")) return "Ya existe uno con ese nombre";
    return error.message;
  }
  return "Algo ha fallado";
}
