// Supabase simulada en memoria para el modo demo y los tests de pantalla.
// Implementa lo justo de PostgREST (select con relaciones, filtros, orden, insert/upsert/update/delete y RPC),
// el usuario de Auth y el almacenamiento de fotos. Los datos se reinician al arrancar el servidor.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { hoyISO } from "../src/dominio/caducidad";
import { datosIniciales, HOGAR_ID, USUARIO_DEMO, type Fila, type Tablas } from "./datos";

export const RUTA_DEMO = "/demo-supabase";

// Relaciones que usa la app en sus select embebidos: alias → [tabla, columna local, columna remota, muchos].
const RELACIONES: Record<string, Record<string, [string, string, string, boolean]>> = {
  miembro: { hogar: ["hogar", "hogar_id", "id", false] },
  producto: { ingrediente: ["ingrediente", "ingrediente_id", "id", false] },
  lote_despensa: { producto: ["producto", "producto_id", "id", false] },
  movimiento_despensa: { producto: ["producto", "producto_id", "id", false] },
  receta: { ingredientes: ["receta_ingrediente", "id", "receta_id", true], pasos: ["paso_receta", "id", "receta_id", true] },
  receta_ingrediente: { ingrediente: ["ingrediente", "ingrediente_id", "id", false] },
  franja_menu: { receta: ["receta", "receta_id", "id", false] },
};

const DEFECTOS: Record<string, Fila> = {
  item_lista: { marcado: false, origen: "manual", cantidad: null, cantidad_base: null, ingrediente_id: null, seccion_super: "Otros" },
  franja_menu: { receta_id: null, raciones: 2, fuera_de_casa: false, es_sobra_de: null, cocinado: false },
  ingrediente: { unidad_base: "g", seccion_super: "Otros", grupo_alimento: null, siempre_disponible: false, stock_minimo: null, caducidad_defecto_dias: null, emoji: null, peso_unidad_g: null, nutrientes_100: null, alergenos: [], dias_tras_abrir: null, equivalencias: null },
  producto: { ean: null, marca: null, fuente: "manual", foto_url: null, nutrientes_100: null, nutriscore: null, nova: null, niveles_nutrientes: null, aditivos: null, alergenos: null, completitud_datos: null, mercadona_id: null, caducidad_habitual_dias: null },
  lote_despensa: { fecha_caducidad: null, abierto_en: null },
  racion_congelada: { receta_id: null },
};

interface Seleccion {
  columnas: string[] | "*";
  embebidos: { alias: string; tabla: string; sub: Seleccion }[];
}

function partirNivelSuperior(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let actual = "";
  for (const c of texto) {
    if (c === "(") nivel++;
    if (c === ")") nivel--;
    if (c === "," && nivel === 0) {
      partes.push(actual.trim());
      actual = "";
    } else actual += c;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
}

function parsearSeleccion(texto: string): Seleccion {
  const seleccion: Seleccion = { columnas: [], embebidos: [] };
  for (const parte of partirNivelSuperior(texto || "*")) {
    const m = /^(?:(\w+):)?(\w+)\((.*)\)$/s.exec(parte);
    if (m) seleccion.embebidos.push({ alias: m[1] ?? m[2], tabla: m[2], sub: parsearSeleccion(m[3]) });
    else if (parte === "*") seleccion.columnas = "*";
    else if (seleccion.columnas !== "*") seleccion.columnas.push(parte);
  }
  return seleccion;
}

function proyectar(db: Tablas, tabla: string, fila: Fila, sel: Seleccion): Fila {
  const salida: Fila = sel.columnas === "*" ? { ...fila } : Object.fromEntries(sel.columnas.map((c) => [c, fila[c]]));
  for (const e of sel.embebidos) {
    const rel = RELACIONES[tabla]?.[e.alias];
    if (!rel) continue;
    const [destino, local, remota, muchos] = rel;
    const candidatas = (db[destino] ?? []).filter((r) => r[remota] === fila[local]);
    salida[e.alias] = muchos ? candidatas.map((r) => proyectar(db, destino, r, e.sub)) : candidatas[0] ? proyectar(db, destino, candidatas[0], e.sub) : null;
  }
  return salida;
}

const RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function cumple(fila: Fila, columna: string, condicion: string): boolean {
  const negado = condicion.startsWith("not.");
  const [op, ...resto] = (negado ? condicion.slice(4) : condicion).split(".");
  const valor = resto.join(".");
  const actual = fila[columna];
  const texto = actual === null || actual === undefined ? null : String(actual);
  let r: boolean;
  switch (op) {
    case "eq":
      r = texto === valor;
      break;
    case "neq":
      r = texto !== valor;
      break;
    case "gt":
      r = texto !== null && texto > valor;
      break;
    case "gte":
      r = texto !== null && texto >= valor;
      break;
    case "lt":
      r = texto !== null && texto < valor;
      break;
    case "lte":
      r = texto !== null && texto <= valor;
      break;
    case "is":
      r = valor === "null" ? texto === null : texto === valor;
      break;
    case "in":
      r = valor
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((v) => v.replace(/^"|"$/g, ""))
        .includes(texto ?? "");
      break;
    default:
      r = true;
  }
  return negado ? !r : r;
}

function filtrar(filas: Fila[], params: URLSearchParams): Fila[] {
  let resultado = filas;
  for (const [clave, valor] of params) {
    if (RESERVADOS.has(clave)) continue;
    resultado = resultado.filter((f) => cumple(f, clave, valor));
  }
  return resultado;
}

function ordenar(filas: Fila[], orden: string | null): Fila[] {
  if (!orden) return filas;
  const criterios = orden.split(",").map((c) => {
    const [columna, ...mods] = c.split(".");
    return { columna, desc: mods.includes("desc"), nullsPrimero: mods.includes("nullsfirst") };
  });
  return [...filas].sort((a, b) => {
    for (const { columna, desc, nullsPrimero } of criterios) {
      const x = a[columna];
      const y = b[columna];
      if (x === y) continue;
      if (x === null || x === undefined) return nullsPrimero ? -1 : 1;
      if (y === null || y === undefined) return nullsPrimero ? 1 : -1;
      const c = String(x).localeCompare(String(y), "es", { numeric: true });
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

function leerCuerpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolver) => {
    const trozos: Buffer[] = [];
    req.on("data", (t: Buffer) => trozos.push(t));
    req.on("end", () => resolver(Buffer.concat(trozos)));
  });
}

function nuevaFila(tabla: string, datos: Fila): Fila {
  return { ...(DEFECTOS[tabla] ?? {}), id: crypto.randomUUID(), creado_en: new Date().toISOString(), ...datos };
}

export function supabaseDemo(): Plugin {
  let db = datosIniciales(hoyISO());
  const fotos = new Map<string, { tipo: string; datos: Buffer }>();

  return {
    name: "supabase-demo",
    configureServer(server) {
      server.middlewares.use(RUTA_DEMO, async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? "/", "http://demo");
        const enviar = (cuerpo: unknown, status = 200) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(cuerpo === undefined ? "" : JSON.stringify(cuerpo));
        };
        const ruta = url.pathname;
        const metodo = req.method ?? "GET";

        // Reinicio para los tests de pantalla.
        if (ruta === "/__reiniciar") {
          db = datosIniciales(hoyISO());
          return enviar({ ok: true });
        }

        // Auth
        if (ruta.startsWith("/auth/v1/user")) return enviar(USUARIO_DEMO);
        if (ruta.startsWith("/auth/v1/logout")) return enviar(undefined, 204);
        if (ruta.startsWith("/auth/v1/token")) {
          return enviar({ access_token: "demo", token_type: "bearer", expires_in: 86400 * 365, refresh_token: "demo", user: USUARIO_DEMO });
        }

        // Storage
        const foto = /^\/storage\/v1\/object\/(?:public\/)?fotos\/(.+)$/.exec(ruta);
        if (foto) {
          if (metodo === "GET") {
            const f = fotos.get(foto[1]);
            if (!f) return enviar({ error: "No existe" }, 404);
            res.setHeader("Content-Type", f.tipo);
            return res.end(f.datos);
          }
          fotos.set(foto[1], { tipo: String(req.headers["content-type"] ?? "image/jpeg"), datos: await leerCuerpo(req) });
          return enviar({ Key: `fotos/${foto[1]}` });
        }

        // RPC
        const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(ruta);
        if (rpc) {
          const args = JSON.parse((await leerCuerpo(req)).toString() || "{}");
          return enviar(...ejecutarRpc(db, rpc[1], args));
        }

        // Tablas
        const tabla = /^\/rest\/v1\/(\w+)$/.exec(ruta)?.[1];
        if (!tabla) return enviar({ error: "Ruta desconocida" }, 404);
        db[tabla] ??= [];
        const prefer = String(req.headers.prefer ?? "");
        const devolver = prefer.includes("return=representation");
        const unica = String(req.headers.accept ?? "").includes("vnd.pgrst.object");
        const seleccion = parsearSeleccion(url.searchParams.get("select") ?? "*");
        const responder = (filas: Fila[], status = 200) => {
          const proyectadas = filas.map((f) => proyectar(db, tabla, f, seleccion));
          if (unica) return proyectadas.length ? enviar(proyectadas[0], status) : enviar({ message: "No rows" }, 406);
          return enviar(proyectadas, status);
        };

        if (metodo === "GET" || metodo === "HEAD") {
          let filas = ordenar(filtrar(db[tabla], url.searchParams), url.searchParams.get("order"));
          const limite = Number(url.searchParams.get("limit"));
          if (limite) filas = filas.slice(0, limite);
          return responder(filas);
        }

        if (metodo === "POST") {
          const cuerpo = JSON.parse((await leerCuerpo(req)).toString() || "[]");
          const entradas: Fila[] = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
          const conflicto = url.searchParams.get("on_conflict")?.split(",");
          const resultado: Fila[] = [];
          for (const entrada of entradas) {
            const existente = conflicto && db[tabla].find((f) => conflicto.every((c) => f[c] === entrada[c]));
            if (existente) {
              if (prefer.includes("ignore-duplicates")) continue;
              Object.assign(existente, entrada);
              resultado.push(existente);
            } else {
              const fila = nuevaFila(tabla, entrada);
              db[tabla].push(fila);
              resultado.push(fila);
            }
          }
          return devolver ? responder(resultado, 201) : enviar(undefined, 201);
        }

        if (metodo === "PATCH") {
          const cambios = JSON.parse((await leerCuerpo(req)).toString() || "{}");
          const filas = filtrar(db[tabla], url.searchParams);
          for (const f of filas) Object.assign(f, cambios);
          return devolver ? responder(filas) : enviar(undefined, 204);
        }

        if (metodo === "DELETE") {
          const borrar = new Set(filtrar(db[tabla], url.searchParams));
          db[tabla] = db[tabla].filter((f) => !borrar.has(f));
          // Borrados en cascada que la app espera de la base de datos real.
          if (tabla === "producto") {
            const ids = new Set([...borrar].map((f) => f.id));
            db.lote_despensa = db.lote_despensa.filter((l) => !ids.has(l.producto_id as string));
          }
          if (tabla === "receta") {
            const ids = new Set([...borrar].map((f) => f.id));
            for (const t of ["receta_ingrediente", "paso_receta"]) db[t] = db[t].filter((r) => !ids.has(r.receta_id as string));
            for (const f of db.franja_menu) if (ids.has(f.receta_id as string)) f.receta_id = null;
          }
          return devolver ? responder([...borrar]) : enviar(undefined, 204);
        }

        return enviar({ error: "Método no admitido" }, 405);
      });
    },
  };
}

function ejecutarRpc(db: Tablas, nombre: string, args: Record<string, unknown>): [unknown, number?] {
  switch (nombre) {
    case "crear_hogar":
    case "unirse_hogar":
      return [db.hogar[0]];
    case "regenerar_codigo_invitacion":
      return [(db.hogar[0].codigo_invitacion = "NUEVO234")];
    case "guardar_receta": {
      const datos = args.p_receta as Fila;
      let receta = db.receta.find((r) => r.id === datos.id);
      if (!receta) {
        receta = nuevaFila("receta", { hogar_id: HOGAR_ID });
        db.receta.push(receta);
      }
      const vacio = (v: unknown) => (v === "" ? null : v);
      Object.assign(receta, {
        nombre: datos.nombre,
        raciones: Number(datos.raciones),
        tiempo_prep_min: vacio(datos.tiempo_prep_min),
        tiempo_coccion_min: vacio(datos.tiempo_coccion_min),
        preparacion_previa: vacio(datos.preparacion_previa),
        preparacion_previa_horas: vacio(datos.preparacion_previa_horas),
        etiquetas: datos.etiquetas,
        valoracion: vacio(datos.valoracion),
        notas: vacio(datos.notas),
        actualizado_en: new Date().toISOString(),
      });
      receta.foto_url ??= null;
      receta.fuente_url ??= null;
      const id = receta.id as string;
      db.receta_ingrediente = db.receta_ingrediente.filter((r) => r.receta_id !== id);
      (args.p_ingredientes as Fila[]).forEach((l, orden) => db.receta_ingrediente.push(nuevaFila("receta_ingrediente", { ...l, hogar_id: HOGAR_ID, receta_id: id, orden })));
      db.paso_receta = db.paso_receta.filter((p) => p.receta_id !== id);
      (args.p_pasos as Fila[]).forEach((p, orden) =>
        db.paso_receta.push(
          nuevaFila("paso_receta", { hogar_id: HOGAR_ID, receta_id: id, orden, texto: p.texto, temporizador_seg: vacio(p.temporizador_seg), temporizador_nombre: vacio(p.temporizador_nombre) }),
        ),
      );
      return [id];
    }
    case "aplicar_cambios_despensa":
      try {
        aplicarCambios(db, args.p_cambios as CambiosDespensa);
      } catch (error) {
        return [{ message: (error as Error).message }, 400];
      }
      return [null];
    case "registrar_suscripcion_push":
      return [null];
    default:
      return [{ message: `RPC ${nombre} no simulada` }, 404];
  }
}

/** Misma forma que la función SQL aplicar_cambios_despensa. */
interface CambiosDespensa {
  lotes_crear?: Fila[];
  lotes_actualizar?: { id: string; cantidad?: number; fecha_caducidad?: string | null; abierto_en?: string | null }[];
  lotes_delta?: { id: string; delta: number }[];
  lotes_borrar?: string[];
  movimientos?: Fila[];
  items_borrar?: string[];
  franja_cocinada?: string | null;
  racion_congelada?: Fila;
}

function aplicarCambios(db: Tablas, c: CambiosDespensa) {
  for (const l of c.lotes_crear ?? []) db.lote_despensa.push(nuevaFila("lote_despensa", { ...l, hogar_id: HOGAR_ID }));
  for (const a of c.lotes_actualizar ?? []) {
    const { id, ...cambios } = a;
    Object.assign(db.lote_despensa.find((l) => l.id === id) ?? {}, cambios);
  }
  for (const d of c.lotes_delta ?? []) {
    const lote = db.lote_despensa.find((l) => l.id === d.id);
    if (!lote) throw new Error("Ese lote ya no está en la despensa");
    lote.cantidad = Number(lote.cantidad) + d.delta;
    if (Number(lote.cantidad) <= 0.0001) db.lote_despensa = db.lote_despensa.filter((l) => l !== lote);
  }
  db.lote_despensa = db.lote_despensa.filter((l) => !(c.lotes_borrar ?? []).includes(l.id as string));
  if (c.racion_congelada) db.racion_congelada.push(nuevaFila("racion_congelada", { ...c.racion_congelada, hogar_id: HOGAR_ID }));
  for (const m of c.movimientos ?? []) db.movimiento_despensa.push(nuevaFila("movimiento_despensa", { ...m, hogar_id: HOGAR_ID }));
  db.item_lista = db.item_lista.filter((i) => !(c.items_borrar ?? []).includes(i.id as string));
  if (c.franja_cocinada) Object.assign(db.franja_menu.find((f) => f.id === c.franja_cocinada) ?? {}, { cocinado: true });
}
