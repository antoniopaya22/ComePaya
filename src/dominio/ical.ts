import type { FechaISO } from "./caducidad.js";
import { HORA_FRANJA, ZONA } from "./recordatorios.js";

export interface FranjaIcal {
  id: string;
  fecha: FechaISO;
  tipo: "comida" | "cena";
  fuera_de_casa: boolean;
  es_sobra_de: string | null;
  receta: { nombre: string } | null;
}

/** Feed iCal del menú (§4.4): un evento de una hora por comida o cena planificada. */
export function generarIcal(nombreHogar: string, franjas: FranjaIcal[], generado: Date): string {
  const sello = generado.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ComePaya//Menu semanal//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(`Menú · ${nombreHogar}`)}`,
    `X-WR-TIMEZONE:${ZONA}`,
  ];
  for (const f of franjas) {
    if (!f.receta && !f.fuera_de_casa) continue;
    const titulo = f.fuera_de_casa ? "Fuera de casa" : `${f.receta!.nombre}${f.es_sobra_de ? " (sobras)" : ""}`;
    const dia = f.fecha.replace(/-/g, "");
    const hora = HORA_FRANJA[f.tipo];
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${f.id}@despensa`,
      `DTSTAMP:${sello}`,
      `DTSTART;TZID=${ZONA}:${dia}T${String(hora).padStart(2, "0")}0000`,
      `DTEND;TZID=${ZONA}:${dia}T${String(hora + 1).padStart(2, "0")}0000`,
      `SUMMARY:${escapar(`${f.tipo === "comida" ? "Comida" : "Cena"}: ${titulo}`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lineas.push("END:VCALENDAR");
  return lineas.map(plegar).join("\r\n") + "\r\n";
}

function escapar(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** RFC 5545: líneas de como mucho 75 octetos, continuadas con un espacio. */
function plegar(linea: string): string {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;
  const partes: string[] = [];
  let actual = "";
  for (const caracter of linea) {
    const limite = partes.length ? 74 : 75;
    if (new TextEncoder().encode(actual + caracter).length > limite) {
      partes.push(actual);
      actual = caracter;
    } else {
      actual += caracter;
    }
  }
  partes.push(actual);
  return partes.join("\r\n ");
}
