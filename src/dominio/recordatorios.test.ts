import { describe, expect, it } from "vitest";
import { avisosCaducidad, avisosPreparacion, endpointPushPermitido, formatearTemporizador, horaLocal, segundosRestantes, type FranjaAviso } from "./recordatorios.js";

describe("horaLocal", () => {
  it("convierte a hora de España en invierno y en verano", () => {
    expect(horaLocal(new Date("2026-11-01T20:30:00Z"))).toMatchObject({ fecha: "2026-11-01", hora: 21 });
    expect(horaLocal(new Date("2026-07-01T20:30:00Z"))).toMatchObject({ fecha: "2026-07-01", hora: 22 });
    expect(horaLocal(new Date("2026-11-01T23:30:00Z"))).toMatchObject({ fecha: "2026-11-02", hora: 0 });
  });
});

const franja = (extra: Partial<FranjaAviso> = {}): FranjaAviso => ({
  id: "f1",
  hogar_id: "h1",
  fecha: "2026-11-03",
  tipo: "comida",
  fuera_de_casa: false,
  es_sobra_de: null,
  cocinado: false,
  receta: { id: "r1", nombre: "Cocido", preparacion_previa: "Poner los garbanzos en remojo", preparacion_previa_horas: 12 },
  ...extra,
});

describe("avisosPreparacion", () => {
  // Comida del día 3 a las 14:00 locales (13:00 UTC en noviembre); 12 h antes son las 02:00 locales del día 3.
  it("avisa dentro de la ventana de antelación", () => {
    const avisos = avisosPreparacion([franja()], new Date("2026-11-03T01:30:00Z")); // 02:30 locales
    expect(avisos).toEqual([
      {
        clave: "prep:f1",
        hogar_id: "h1",
        titulo: "Poner los garbanzos en remojo",
        cuerpo: "Para cocido (comida de hoy).",
        url: "/recetas/r1",
      },
    ]);
  });

  it("no avisa antes de tiempo ni después de la comida", () => {
    expect(avisosPreparacion([franja()], new Date("2026-11-03T00:30:00Z"))).toEqual([]); // 01:30 locales
    expect(avisosPreparacion([franja()], new Date("2026-11-03T13:30:00Z"))).toEqual([]); // 14:30 locales
  });

  it("sin horas indicadas avisa desde las 21:00 de la víspera", () => {
    const f = franja({ receta: { id: "r1", nombre: "Pollo asado", preparacion_previa: "Sacar el pollo del congelador", preparacion_previa_horas: null } });
    expect(avisosPreparacion([f], new Date("2026-11-02T19:30:00Z"))).toEqual([]); // 20:30 locales
    expect(avisosPreparacion([f], new Date("2026-11-02T20:30:00Z"))[0].cuerpo).toBe("Para pollo asado (comida de mañana).");
  });

  it("ignora franjas fuera de casa, de sobras, cocinadas o sin preparación", () => {
    const ahora = new Date("2026-11-03T05:00:00Z");
    expect(
      avisosPreparacion(
        [
          franja({ fuera_de_casa: true }),
          franja({ es_sobra_de: "f0" }),
          franja({ cocinado: true }),
          franja({ receta: { id: "r", nombre: "Ensalada", preparacion_previa: null, preparacion_previa_horas: null } }),
          franja({ receta: null }),
        ],
        ahora,
      ),
    ).toEqual([]);
  });
});

describe("avisosCaducidad", () => {
  const lotes = [
    { hogar_id: "h1", nombre: "Leche", fecha_caducidad: "2026-11-02" },
    { hogar_id: "h1", nombre: "Chorizo", fecha_caducidad: "2026-11-01" },
    { hogar_id: "h1", nombre: "Arroz", fecha_caducidad: "2027-05-01" },
    { hogar_id: "h1", nombre: "Yogur", fecha_caducidad: "2026-10-30" },
    { hogar_id: "h2", nombre: "Pollo", fecha_caducidad: "2026-11-03" },
  ];

  it("agrupa por hogar lo que caduca en los próximos dos días", () => {
    const avisos = avisosCaducidad(lotes, new Date("2026-11-01T10:00:00Z")); // 11:00 locales
    expect(avisos).toEqual([
      { clave: "cad:h1:2026-11-01", hogar_id: "h1", titulo: "2 productos caducan pronto", cuerpo: "Chorizo (hoy), Leche (mañana)", url: "/despensa" },
      { clave: "cad:h2:2026-11-01", hogar_id: "h2", titulo: "Pollo caduca pronto", cuerpo: "Pollo (3/11)", url: "/despensa" },
    ]);
  });

  it("no avisa antes de las 10:00", () => {
    expect(avisosCaducidad(lotes, new Date("2026-11-01T07:00:00Z"))).toEqual([]);
  });
});

describe("temporizadores", () => {
  it("redondea hacia arriba y no baja de cero", () => {
    expect(segundosRestantes(10_500, 0)).toBe(11);
    expect(segundosRestantes(1000, 5000)).toBe(0);
  });

  it.each([
    [0, "0:00"],
    [65, "1:05"],
    [2400, "40:00"],
    [3725, "1:02:05"],
  ])("%i s → %s", (s, texto) => {
    expect(formatearTemporizador(s)).toBe(texto);
  });
});

describe("endpointPushPermitido", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:123",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://wns2-db5p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/QGuQyavXutnMH",
  ])("acepta %s", (url) => {
    expect(endpointPushPermitido(url)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.atacante.com/x",
    "https://atacante.com/push.apple.com/",
    "https://169.254.169.254/latest/meta-data/",
    "https://evilpush.services.mozilla.com.evil/x",
  ])("rechaza %s", (url) => {
    expect(endpointPushPermitido(url)).toBe(false);
  });
});
