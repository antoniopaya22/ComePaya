import { diasHasta, sumarDias, type FechaISO } from "./caducidad";

// Recordatorios (§4.6). Todo se calcula en hora local de España, sin depender de la zona del servidor.

export const ZONA = "Europe/Madrid";

/** Hora a la que se suele comer y cenar: la preparación previa se cuenta hacia atrás desde aquí. */
export const HORA_FRANJA = { comida: 14, cena: 21 } as const;

/** Hora a partir de la cual se manda el aviso diario de caducidades. */
export const HORA_AVISO_CADUCIDAD = 10;

/** Días de margen para avisar de caducidad (incluye lo que caduca hoy). */
export const DIAS_AVISO = 2;

/** Fecha y hora local (zona dada) de un instante, como minutos desde 1970 "en hora local" para poder comparar. */
export function horaLocal(instante: Date, zona = ZONA): { fecha: FechaISO; hora: number; minutos: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  const fecha = `${partes.year}-${partes.month}-${partes.day}`;
  const hora = Number(partes.hour);
  return { fecha, hora, minutos: minutosLocales(fecha, hora) + Number(partes.minute) };
}

function minutosLocales(fecha: FechaISO, hora: number): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return Date.UTC(a, m - 1, d, hora) / 60_000;
}

export interface Aviso {
  /** Identifica el aviso para no mandarlo dos veces. */
  clave: string;
  hogar_id: string;
  titulo: string;
  cuerpo: string;
  url: string;
}

export interface FranjaAviso {
  id: string;
  hogar_id: string;
  fecha: FechaISO;
  tipo: "comida" | "cena";
  fuera_de_casa: boolean;
  es_sobra_de: string | null;
  cocinado: boolean;
  receta: { id: string; nombre: string; preparacion_previa: string | null; preparacion_previa_horas: number | null } | null;
}

/**
 * Avisos de preparación previa: se mandan desde `horas` antes de la comida o cena hasta esa hora.
 * Si la receta no indica horas, se avisa la noche anterior a las 21:00.
 */
export function avisosPreparacion(franjas: FranjaAviso[], ahora: Date): Aviso[] {
  const { minutos: ahoraLocal } = horaLocal(ahora);
  const avisos: Aviso[] = [];
  for (const f of franjas) {
    const r = f.receta;
    if (!r?.preparacion_previa || f.fuera_de_casa || f.es_sobra_de || f.cocinado) continue;
    const momentoFranja = minutosLocales(f.fecha, HORA_FRANJA[f.tipo]);
    const momentoAviso = r.preparacion_previa_horas
      ? momentoFranja - r.preparacion_previa_horas * 60
      : minutosLocales(sumarDias(f.fecha, -1), 21);
    if (ahoraLocal < momentoAviso || ahoraLocal >= momentoFranja) continue;
    avisos.push({
      clave: `prep:${f.id}`,
      hogar_id: f.hogar_id,
      titulo: `${r.preparacion_previa}`,
      cuerpo: `Para ${r.nombre.toLowerCase()} (${f.tipo} ${conPreposicion(describirDia(f.fecha, horaLocal(ahora).fecha))}).`,
      url: `/recetas/${r.id}`,
    });
  }
  return avisos;
}

export interface LoteAviso {
  hogar_id: string;
  nombre: string;
  fecha_caducidad: FechaISO;
}

/** Un aviso diario por hogar con lo que caduca en los próximos días, desde las 10:00 hora local. */
export function avisosCaducidad(lotes: LoteAviso[], ahora: Date): Aviso[] {
  const { fecha: hoy, hora } = horaLocal(ahora);
  if (hora < HORA_AVISO_CADUCIDAD) return [];
  const porHogar = new Map<string, LoteAviso[]>();
  for (const l of lotes) {
    const dias = diasHasta(l.fecha_caducidad, hoy);
    if (dias < 0 || dias > DIAS_AVISO) continue;
    porHogar.set(l.hogar_id, [...(porHogar.get(l.hogar_id) ?? []), l]);
  }
  return [...porHogar.entries()].map(([hogar_id, lista]) => {
    const ordenados = [...lista].sort((a, b) => a.fecha_caducidad.localeCompare(b.fecha_caducidad));
    const texto = ordenados.map((l) => `${l.nombre} (${describirDia(l.fecha_caducidad, hoy)})`);
    return {
      clave: `cad:${hogar_id}:${hoy}`,
      hogar_id,
      titulo: ordenados.length === 1 ? `${ordenados[0].nombre} caduca pronto` : `${ordenados.length} productos caducan pronto`,
      cuerpo: texto.slice(0, 4).join(", ") + (texto.length > 4 ? "…" : ""),
      url: "/despensa",
    };
  });
}

function describirDia(fecha: FechaISO, hoy: FechaISO): string {
  const dias = diasHasta(fecha, hoy);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  const [, mes, dia] = fecha.split("-");
  return `${Number(dia)}/${Number(mes)}`;
}

function conPreposicion(dia: string): string {
  return dia === "hoy" || dia === "mañana" ? `de ${dia}` : `del ${dia}`;
}

/** Temporizadores del modo cocina: segundos que quedan y formato m:ss. */
export function segundosRestantes(finEnMs: number, ahoraMs: number): number {
  return Math.max(0, Math.ceil((finEnMs - ahoraMs) / 1000));
}

export function formatearTemporizador(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
