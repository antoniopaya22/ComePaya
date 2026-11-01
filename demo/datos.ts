// Datos de ejemplo del modo demo. Las fechas se calculan desde hoy para que la demo siempre tenga sentido.
import { sumarDias, type FechaISO } from "../src/dominio/caducidad";
import { INGREDIENTES_BASE } from "../src/dominio/ingredientes-base";
import { lunesDe } from "../src/dominio/menu";

export const HOGAR_ID = "11111111-1111-4111-8111-111111111111";
export const USUARIO_ID = "22222222-2222-4222-8222-222222222222";

export type Fila = Record<string, unknown> & { id?: string };
export type Tablas = Record<string, Fila[]>;

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();

export function datosIniciales(hoy: FechaISO): Tablas {
  const lunes = lunesDe(hoy);
  const ing = INGREDIENTES_BASE.map((b, i) => ({
    ...b,
    id: `ing-${i}`,
    hogar_id: HOGAR_ID,
    stock_minimo: b.nombre === "Huevo" ? 6 : b.nombre === "Leche" ? 2000 : null,
    nutrientes_100: null,
    equivalencias: null,
    creado_en: hace(30),
  }));
  const id = (nombre: string) => ing.find((i) => i.nombre === nombre)!.id;
  // Valores aproximados solo para que la demo muestre nutrición por ración.
  ing.find((i) => i.nombre === "Lentejas")!.nutrientes_100 = { kcal: 330, proteina: 24, fibra: 11, azucares: 2, sal: 0.1 } as never;
  ing.find((i) => i.nombre === "Chorizo")!.nutrientes_100 = { kcal: 450, proteina: 22, sal: 4, azucares: 1 } as never;

  const producto = (pid: string, nombre: string, marca: string | null, ingrediente: string, envase: number, extra: Fila = {}) => ({
    id: pid,
    hogar_id: HOGAR_ID,
    ingrediente_id: id(ingrediente),
    ean: null,
    nombre,
    marca,
    cantidad_envase: envase,
    fuente: "manual",
    foto_url: null,
    nutrientes_100: null,
    nutriscore: null,
    nova: null,
    niveles_nutrientes: null,
    aditivos: null,
    alergenos: null,
    completitud_datos: null,
    mercadona_id: null,
    caducidad_habitual_dias: null,
    creado_en: hace(20),
    ...extra,
  });
  const productos = [
    producto("p-lentejas", "Lentejas pardinas", "Hacendado", "Lentejas", 1000),
    producto("p-chorizo", "Chorizo dulce", "Revilla", "Chorizo", 200),
    producto("p-huevos", "Huevos L", "Hacendado", "Huevo", 12),
    producto("p-leche", "Leche semidesnatada", "Pascual", "Leche", 1000, { ean: "8410128000016" }),
    producto("p-tomate", "Tomate triturado", "Hacendado", "Tomate triturado", 400, {
      ean: "8480000160164",
      nutriscore: "b",
      nova: 4,
      niveles_nutrientes: { grasa: "bajo", saturadas: "bajo", azucares: "moderado", sal: "moderado" },
      nutrientes_100: { kcal: 35, grasa: 0.3, azucares: 4.5, sal: 0.6, proteina: 1.5 },
      completitud_datos: 1,
      fuente: "openfoodfacts",
    }),
    producto("p-pollo", "Muslos de pollo", null, "Muslos de pollo", 500),
    producto("p-patatas", "Patatas", null, "Patata", 2000),
  ];

  const lote = (lid: string, pid: string, cantidad: number, ubicacion: string, dias: number | null) => ({
    id: lid,
    hogar_id: HOGAR_ID,
    producto_id: pid,
    cantidad,
    ubicacion,
    fecha_caducidad: dias === null ? null : sumarDias(hoy, dias),
    abierto_en: null,
    creado_en: hace(5),
  });

  const ri = (rid: string, ingrediente: string, cantidad: number, orden: number, opcional = false) => ({
    id: rid,
    hogar_id: HOGAR_ID,
    receta_id: "",
    ingrediente_id: id(ingrediente),
    cantidad,
    opcional,
    orden,
  });
  const receta = (rid: string, nombre: string, extra: Fila, ingredientes: ReturnType<typeof ri>[], pasos: string[] = []) => ({
    receta: {
      id: rid,
      hogar_id: HOGAR_ID,
      nombre,
      raciones: 2,
      tiempo_prep_min: null,
      tiempo_coccion_min: null,
      preparacion_previa: null,
      preparacion_previa_horas: null,
      etiquetas: [],
      valoracion: null,
      notas: null,
      foto_url: null,
      fuente_url: null,
      creado_en: hace(20),
      actualizado_en: hace(20),
      ...extra,
    },
    ingredientes: ingredientes.map((i) => ({ ...i, receta_id: rid })),
    pasos: pasos.map((texto, orden) => ({
      id: `${rid}-paso-${orden}`,
      hogar_id: HOGAR_ID,
      receta_id: rid,
      orden,
      texto,
      temporizador_seg: /cuece/i.test(texto) ? 2400 : null,
      temporizador_nombre: /cuece/i.test(texto) ? "Cocción" : null,
    })),
  });
  const recetas = [
    receta(
      "r-lentejas",
      "Lentejas con chorizo",
      { raciones: 4, tiempo_prep_min: 10, tiempo_coccion_min: 45, etiquetas: ["legumbre", "cuchara"], valoracion: 5, notas: "Mejor de un día para otro." },
      [ri("a1", "Lentejas", 400, 0), ri("a2", "Chorizo", 200, 1), ri("a3", "Patata", 300, 2), ri("a4", "Aceite de oliva", 30, 3), ri("a5", "Tomate triturado", 100, 4, true)],
      ["Sofríe el chorizo en rodajas.", "Añade las lentejas, la patata troceada y cubre con agua.", "Cuece a fuego medio hasta que estén tiernas."],
    ),
    receta(
      "r-tortilla",
      "Tortilla de patatas",
      { tiempo_prep_min: 15, tiempo_coccion_min: 25, etiquetas: ["rápida"], valoracion: 4 },
      [ri("b1", "Huevo", 5, 0), ri("b2", "Patata", 500, 1), ri("b3", "Aceite de oliva", 100, 2)],
      ["Pela y corta las patatas.", "Fríelas a fuego suave.", "Bate los huevos, mezcla y cuaja la tortilla."],
    ),
    receta(
      "r-pollo",
      "Pollo al horno con patatas",
      { raciones: 3, tiempo_prep_min: 15, tiempo_coccion_min: 60, etiquetas: ["horno"], preparacion_previa: "Sacar el pollo del congelador", preparacion_previa_horas: 12 },
      [ri("c1", "Muslos de pollo", 750, 0), ri("c2", "Patata", 600, 1)],
      ["Precalienta el horno a 200 ºC.", "Hornea el pollo con las patatas una hora."],
    ),
    receta(
      "r-merluza",
      "Merluza en salsa verde",
      { tiempo_prep_min: 10, tiempo_coccion_min: 15, etiquetas: ["pescado", "rápida"], valoracion: 4 },
      [ri("d1", "Merluza", 400, 0), ri("d2", "Perejil", 10, 1), ri("d3", "Ajo", 2, 2)],
    ),
  ];

  const franja = (fid: string, dia: number, tipo: string, extra: Fila) => ({
    id: fid,
    hogar_id: HOGAR_ID,
    fecha: sumarDias(lunes, dia),
    tipo,
    receta_id: null,
    raciones: 2,
    fuera_de_casa: false,
    es_sobra_de: null,
    cocinado: false,
    creado_en: hace(7),
    ...extra,
  });
  const indiceHoy = Math.round((Date.parse(hoy) - Date.parse(lunes)) / 86_400_000);
  // Lo de hoy va primero: si coincide con otra franja (lunes y martes), se queda lo de hoy.
  const franjas = [
    franja("f4", indiceHoy, "comida", { receta_id: "r-pollo" }),
    franja("f5", Math.min(6, indiceHoy + 1), "cena", { receta_id: "r-tortilla" }),
    franja("f1", 0, "comida", { receta_id: "r-lentejas", cocinado: indiceHoy > 0 }),
    franja("f2", 1, "comida", { receta_id: "r-lentejas", es_sobra_de: "f1", cocinado: indiceHoy > 1 }),
    franja("f3", 2, "cena", { fuera_de_casa: true }),
  ].filter((f, i, todas) => todas.findIndex((x) => x.fecha === f.fecha && x.tipo === f.tipo) === i);

  return {
    hogar: [
      {
        id: HOGAR_ID,
        nombre: "Casa de prueba",
        codigo_invitacion: "DEMO2345",
        comensales: 2,
        aditivos_vigilados: ["E250"],
        alergenos: [],
        ical_token: "0123456789abcdef0123456789abcdef",
        creado_por: USUARIO_ID,
        creado_en: hace(30),
      },
    ],
    miembro: [
      { hogar_id: HOGAR_ID, user_id: USUARIO_ID, nombre: "Persona de prueba", email: "demo@despensa.test", rol: "admin", creado_en: hace(30) },
      { hogar_id: HOGAR_ID, user_id: "33333333-3333-4333-8333-333333333333", nombre: "Otra persona", email: "pareja@despensa.test", rol: "miembro", creado_en: hace(29) },
    ],
    ingrediente: ing,
    producto: productos,
    lote_despensa: [
      lote("l1", "p-chorizo", 200, "nevera", 2),
      lote("l2", "p-leche", 1000, "nevera", -1),
      lote("l3", "p-leche", 2000, "despensa", 120),
      lote("l4", "p-huevos", 6, "nevera", 12),
      lote("l5", "p-pollo", 1000, "congelador", 60),
      lote("l6", "p-tomate", 800, "despensa", 300),
      lote("l7", "p-lentejas", 500, "despensa", null),
      lote("l8", "p-patatas", 1500, "despensa", 20),
    ],
    movimiento_despensa: [{ id: "m1", hogar_id: HOGAR_ID, producto_id: "p-leche", cantidad: 1000, tipo: "alta", motivo: "Compra", creado_en: hace(5) }],
    tienda: [
      {
        id: "t1",
        hogar_id: HOGAR_ID,
        nombre: "Mercadona",
        orden_secciones: ["Fruta y verdura", "Panadería", "Carnicería", "Pescadería", "Charcutería y quesos", "Lácteos y huevos", "Despensa", "Conservas", "Bebidas", "Congelados", "Droguería", "Higiene", "Otros"],
        creado_en: hace(30),
      },
    ],
    item_lista: [
      { id: "i1", hogar_id: HOGAR_ID, texto: "Pan", cantidad: null, cantidad_base: null, ingrediente_id: id("Pan"), seccion_super: "Panadería", marcado: false, origen: "manual", creado_en: hace(1) },
      { id: "i2", hogar_id: HOGAR_ID, texto: "Plátano", cantidad: "x6", cantidad_base: null, ingrediente_id: id("Plátano"), seccion_super: "Fruta y verdura", marcado: false, origen: "manual", creado_en: hace(1) },
      { id: "i3", hogar_id: HOGAR_ID, texto: "Papel de cocina", cantidad: null, cantidad_base: null, ingrediente_id: null, seccion_super: "Droguería", marcado: false, origen: "manual", creado_en: hace(1) },
    ],
    receta: recetas.map((r) => r.receta),
    receta_ingrediente: recetas.flatMap((r) => r.ingredientes),
    paso_receta: recetas.flatMap((r) => r.pasos),
    franja_menu: franjas,
    regla_semanal: [],
    rechazo_sugerencia: [],
    racion_congelada: [{ id: "rc1", hogar_id: HOGAR_ID, receta_id: null, descripcion: "Albóndigas en salsa", raciones: 2, fecha_congelacion: sumarDias(hoy, -12), creado_en: hace(12) }],
    suscripcion_push: [],
    catalogo_ean: [],
    error_cliente: [],
  };
}

export const USUARIO_DEMO = {
  id: USUARIO_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "demo@despensa.test",
  user_metadata: { full_name: "Persona de prueba" },
  app_metadata: { provider: "google" },
  created_at: "2026-01-01T00:00:00Z",
};
