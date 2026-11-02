/** Fechas de caducidad como "YYYY-MM-DD" (tipo date de Postgres), sin zona horaria. */
export type FechaISO = string;

export type EstadoCaducidad = "sin_fecha" | "caducado" | "pronto" | "ok";

/** Días a partir de los cuales un producto se considera "caduca pronto". */
export const DIAS_AVISO_CADUCIDAD = 3;

const MS_DIA = 24 * 60 * 60 * 1000;

function aUTC(fecha: FechaISO): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

export function hoyISO(ahora: Date = new Date()): FechaISO {
  return aISO(ahora.getFullYear(), ahora.getMonth() + 1, ahora.getDate());
}

export function aISO(anio: number, mes: number, dia: number): FechaISO {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  const d = new Date(aUTC(fecha) + dias * MS_DIA);
  return aISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function sumarMeses(fecha: FechaISO, meses: number): FechaISO {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const total = mes - 1 + meses;
  const nuevoAnio = anio + Math.floor(total / 12);
  const nuevoMes = (((total % 12) + 12) % 12) + 1;
  // 31 de enero + 1 mes → 28/29 de febrero, no 3 de marzo.
  const ultimoDia = new Date(Date.UTC(nuevoAnio, nuevoMes, 0)).getUTCDate();
  return aISO(nuevoAnio, nuevoMes, Math.min(dia, ultimoDia));
}

export function diasHasta(fecha: FechaISO, hoy: FechaISO): number {
  return Math.round((aUTC(fecha) - aUTC(hoy)) / MS_DIA);
}

export function estadoCaducidad(
  fecha: FechaISO | null,
  hoy: FechaISO,
  diasAviso = DIAS_AVISO_CADUCIDAD,
): EstadoCaducidad {
  if (!fecha) return "sin_fecha";
  const dias = diasHasta(fecha, hoy);
  if (dias < 0) return "caducado";
  if (dias <= diasAviso) return "pronto";
  return "ok";
}

/** "Caducado hace 2 días", "Caduca hoy", "Caduca mañana", "Caduca en 5 días", "12/03/2027". */
export function describirCaducidad(fecha: FechaISO | null, hoy: FechaISO): string {
  if (!fecha) return "Sin caducidad";
  const dias = diasHasta(fecha, hoy);
  if (dias < -1) return `Caducó hace ${-dias} días`;
  if (dias === -1) return "Caducó ayer";
  if (dias === 0) return "Caduca hoy";
  if (dias === 1) return "Caduca mañana";
  if (dias <= 30) return `Caduca en ${dias} días`;
  const [anio, mes, dia] = fecha.split("-");
  return `Caduca el ${dia}/${mes}/${anio}`;
}

/** Versión corta para etiquetas de lista: "Caducado", "Hoy", "Mañana", "5 días", "12/03/27", "Sin fecha". */
export function etiquetaCaducidad(fecha: FechaISO | null, hoy: FechaISO): string {
  if (!fecha) return "Sin fecha";
  const dias = diasHasta(fecha, hoy);
  if (dias < 0) return "Caducado";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias <= 30) return `${dias} días`;
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio.slice(2)}`;
}

/**
 * Fecha a partir de día y mes (§7.2: el usuario no escribe el año).
 * Se toma el año actual salvo que la fecha quede más de 30 días en el pasado:
 * entonces se entiende que es del año siguiente (en noviembre, "03/02" es febrero del año que viene).
 * Devuelve null si el día no existe en ese mes.
 */
export function deducirFecha(dia: number, mes: number, hoy: FechaISO): FechaISO | null {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || mes < 1 || mes > 12 || dia < 1) return null;
  const anioActual = Number(hoy.slice(0, 4));
  const candidata = (anio: number) => {
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return dia <= ultimoDia ? aISO(anio, mes, dia) : null;
  };
  const esteAnio = candidata(anioActual);
  if (esteAnio && diasHasta(esteAnio, hoy) >= -30) return esteAnio;
  return candidata(anioActual + 1);
}

export interface AtajoCaducidad {
  etiqueta: string;
  calcular: (hoy: FechaISO) => FechaISO | null;
}

/** Chips rápidos del diálogo de caducidad (§7.2). */
export const ATAJOS_CADUCIDAD: AtajoCaducidad[] = [
  { etiqueta: "+3 días", calcular: (hoy) => sumarDias(hoy, 3) },
  { etiqueta: "+1 semana", calcular: (hoy) => sumarDias(hoy, 7) },
  { etiqueta: "+15 días", calcular: (hoy) => sumarDias(hoy, 15) },
  { etiqueta: "+1 mes", calcular: (hoy) => sumarMeses(hoy, 1) },
  { etiqueta: "+6 meses", calcular: (hoy) => sumarMeses(hoy, 6) },
  { etiqueta: "Sin caducidad", calcular: () => null },
];
