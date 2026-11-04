// Las migraciones, aplicadas de verdad sobre Postgres (PGlite, en WebAssembly) antes de llegar a producción:
// migraciones.yml las aplica en cada push a main sin ensayo previo. Lo propio de Supabase (auth, roles,
// storage, la publicación de tiempo real) va con stubs mínimos; RLS y permisos se prueban con `set role`.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const CARPETA = join(import.meta.dirname, "migrations");
const MIGRACIONES = readdirSync(CARPETA)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

async function baseSupabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema extensions; create schema storage;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    create publication supabase_realtime;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x');
  `);
  return db;
}

/** Cada migración en su transacción, como scripts/aplicar-migracion.mjs. */
async function aplicar(db: PGlite, archivos: string[]) {
  for (const f of archivos) {
    try {
      await db.transaction(async (tx) => {
        await tx.exec(readFileSync(join(CARPETA, f), "utf8"));
      });
    } catch (error) {
      throw new Error(`${f}: ${(error as Error).message}`, { cause: error });
    }
  }
}

/** Ejecuta como un usuario con sesión (rol authenticated, auth.uid() = usuario): RLS y permisos aplican. */
function como(db: PGlite) {
  return async <T = Record<string, unknown>>(usuario: string, sql: string, params?: unknown[]) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${usuario}', false); set role authenticated;`);
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec("reset role;");
    }
  };
}

async function error(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
    return "";
  } catch (e) {
    return (e as Error).message;
  }
}

describe("migraciones", () => {
  let db: PGlite;
  let usuario: ReturnType<typeof como>;
  let hogar: { id: string; codigo_invitacion: string };

  beforeAll(async () => {
    db = await baseSupabase();
    await aplicar(db, MIGRACIONES);
    usuario = como(db);
    [hogar] = await usuario<typeof hogar>(A, "select id, codigo_invitacion from public.crear_hogar('Casa')");
  }, 60_000);

  it("se aplican todas, en orden, sobre una base vacía", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from information_schema.tables where table_schema = 'public'");
    expect(rows[0].n).toBeGreaterThan(15);
  });

  it("el código de invitación tiene 8 caracteres sin ambiguos y no se repite", async () => {
    const { rows } = await db.query<{ c: string }>("select public.generar_codigo_invitacion() c from generate_series(1, 300)");
    expect(rows.every((r) => /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(r.c))).toBe(true);
    expect(new Set(rows.map((r) => r.c)).size).toBe(300);
  });

  it("unirse con un código que no existe cuenta el intento, y con 10 fallos se bloquea", async () => {
    const [malo] = await usuario<{ id: string | null }>(B, "select id from public.unirse_hogar('ZZZZZZZZ')");
    expect(malo.id).toBeNull();
    for (let i = 0; i < 9; i++) await usuario(B, "select public.unirse_hogar('ZZZZZZZZ')");
    expect(await error(usuario(B, "select public.unirse_hogar($1)", [hogar.codigo_invitacion]))).toMatch(/Demasiados intentos/);
    await db.exec("delete from public.intento_union");
    const [unido] = await usuario<{ id: string }>(B, "select id from public.unirse_hogar($1)", [hogar.codigo_invitacion.toLowerCase()]);
    expect(unido.id).toBe(hogar.id);
    await usuario(C, "select public.unirse_hogar($1)", [hogar.codigo_invitacion]);
  });

  it("del hogar solo se editan las columnas permitidas", async () => {
    await usuario(A, "update public.hogar set comensales = 3 where id = $1", [hogar.id]);
    expect(await error(usuario(A, "update public.hogar set codigo_invitacion = 'AAAAAAAA' where id = $1", [hogar.id]))).toMatch(/permission denied/);
    const [{ c }] = await usuario<{ c: string }>(A, "select public.regenerar_codigo_invitacion($1) c", [hogar.id]);
    expect(c).not.toBe(hogar.codigo_invitacion);
  });

  it("solo un admin quita miembros y, si sale el último, el más antiguo pasa a admin", async () => {
    expect(await error(usuario(B, "select public.quitar_miembro($1, $2)", [hogar.id, C]))).toMatch(/Solo un admin/);
    await usuario(A, "select public.quitar_miembro($1, $2)", [hogar.id, C]);
    expect((await db.query("select 1 from public.miembro where hogar_id = $1 and user_id = $2", [hogar.id, C])).rows).toHaveLength(0);
    await usuario(A, "delete from public.miembro where hogar_id = $1 and user_id = $2", [hogar.id, A]);
    const { rows } = await db.query<{ rol: string }>("select rol from public.miembro where hogar_id = $1 and user_id = $2", [hogar.id, B]);
    expect(rows[0].rol).toBe("admin");
  });

  it("guardar_receta: de una vez, sin duplicar al reintentar y juntando ingredientes repetidos", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.ingrediente (hogar_id, nombre, unidad_base) values ($1, 'Lenteja X', 'g'), ($1, 'Chorizo X', 'g') returning id",
      [hogar.id],
    );
    const [lenteja, chorizo] = rows.map((r) => r.id);
    const id = "44444444-4444-4444-8444-444444444444";
    const receta = {
      id,
      hogar_id: hogar.id,
      nombre: "Lentejas",
      raciones: 2,
      tiempo_prep_min: "",
      tiempo_coccion_min: "",
      preparacion_previa: "",
      preparacion_previa_horas: "",
      etiquetas: [],
      valoracion: "",
      notas: "",
      foto_url: "https://x/f.jpg",
      fuente_url: "",
    };
    const lineas = [
      { ingrediente_id: lenteja, cantidad: 200, opcional: false },
      { ingrediente_id: chorizo, cantidad: 50, opcional: true },
      { ingrediente_id: lenteja, cantidad: 100, opcional: false },
    ];
    for (let i = 0; i < 2; i++) await usuario(B, "select public.guardar_receta($1, $2, '[]')", [receta, lineas]);

    expect((await db.query("select foto_url from public.receta where nombre = 'Lentejas'")).rows).toEqual([{ foto_url: "https://x/f.jpg" }]);
    const ri = await db.query<{ ingrediente_id: string; c: number; orden: number }>(
      "select ingrediente_id, cantidad::float c, orden from public.receta_ingrediente where receta_id = $1 order by orden",
      [id],
    );
    expect(ri.rows).toEqual([
      { ingrediente_id: lenteja, c: 300, orden: 0 },
      { ingrediente_id: chorizo, c: 50, orden: 1 },
    ]);

    // Sin id, como el código anterior: crea otra.
    const [{ guardar_receta }] = await usuario<{ guardar_receta: string }>(B, "select public.guardar_receta($1, $2, '[]')", [
      { ...receta, id: "", nombre: "Otra" },
      [lineas[0]],
    ]);
    expect(guardar_receta).not.toBe(id);

    // Unir dos ingredientes que estaban en la misma receta deja una línea con la suma.
    await usuario(B, "select public.unir_ingredientes($1, $2, 1)", [chorizo, lenteja]);
    const tras = await db.query("select cantidad::float c, opcional from public.receta_ingrediente where receta_id = $1", [id]);
    expect(tras.rows).toEqual([{ c: 350, opcional: false }]);
  });

  it("quién apuntó algo lo pone la base de datos y no cambia", async () => {
    await usuario(B, "insert into public.item_lista (hogar_id, texto, creado_por) values ($1, 'Pan', $2)", [hogar.id, A]);
    await usuario(B, "update public.item_lista set creado_por = $1, marcado = true where texto = 'Pan'", [A]);
    expect((await db.query("select creado_por from public.item_lista where texto = 'Pan'")).rows).toEqual([{ creado_por: B }]);
  });

  it("el súper de un artículo es del mismo hogar y, si se borra, el artículo queda para cualquiera", async () => {
    const [{ id: otro }] = await usuario<{ id: string }>(C, "select id from public.crear_hogar('Otra casa')");
    const { rows: ajena } = await db.query<{ id: string }>("insert into public.tienda (hogar_id, nombre) values ($1, 'Ajena') returning id", [otro]);
    expect(await error(db.query("insert into public.item_lista (hogar_id, texto, tienda_id) values ($1, 'Leche', $2)", [hogar.id, ajena[0].id]))).toMatch(
      /foreign key/,
    );
    const { rows: mia } = await db.query<{ id: string }>("insert into public.tienda (hogar_id, nombre) values ($1, 'Mía') returning id", [hogar.id]);
    await db.query("insert into public.item_lista (hogar_id, texto, tienda_id) values ($1, 'Leche', $2)", [hogar.id, mia[0].id]);
    await db.query("delete from public.tienda where id = $1", [mia[0].id]);
    expect((await db.query("select tienda_id from public.item_lista where texto = 'Leche'")).rows).toEqual([{ tienda_id: null }]);
  });

  it("los avisos push solo van a servicios de push conocidos", async () => {
    await usuario(B, "select public.registrar_suscripcion_push($1, 'https://fcm.googleapis.com/fcm/send/x', 'p', 'a')", [hogar.id]);
    expect(await error(usuario(B, "select public.registrar_suscripcion_push($1, 'https://169.254.169.254/x', 'p', 'a')", [hogar.id]))).toMatch(
      /suscripcion_push_endpoint_conocido/,
    );
  });

  it("error_cliente: como mucho 200 por usuario y día, y textos acotados", async () => {
    for (let i = 0; i < 205; i++) await usuario(B, "insert into public.error_cliente (user_id, mensaje) values ($1, 'x')", [B]);
    expect((await db.query("select count(*)::int n from public.error_cliente")).rows).toEqual([{ n: 200 }]);
    await db.exec("delete from public.error_cliente");
    expect(await error(usuario(B, "insert into public.error_cliente (user_id, mensaje) values ($1, repeat('x', 2000))", [B]))).toMatch(
      /error_cliente_tamanos/,
    );
  });
});

describe("20261120000000_integridad_e_indices con datos previos", () => {
  it("junta ingredientes repetidos, renumera pasos y quita súper de otro hogar", async () => {
    const db = await baseSupabase();
    const indice = MIGRACIONES.indexOf("20261120000000_integridad_e_indices.sql");
    await aplicar(db, MIGRACIONES.slice(0, indice));
    await db.exec(`select set_config('request.jwt.claim.sub', '${A}', false)`);
    const [{ id: h1 }] = (await db.query<{ id: string }>("select id from public.crear_hogar('Uno')")).rows;
    const [{ id: h2 }] = (await db.query<{ id: string }>("select id from public.crear_hogar('Dos')")).rows;
    const { rows } = await db.query<{ id: string }>(
      "insert into public.ingrediente (hogar_id, nombre, unidad_base) values ($1, 'I1x', 'g'), ($1, 'I2x', 'g') returning id",
      [h1],
    );
    const [i1, i2] = rows.map((r) => r.id);
    const [{ id: r }] = (await db.query<{ id: string }>("insert into public.receta (hogar_id, nombre) values ($1, 'R') returning id", [h1])).rows;
    await db.query(
      `insert into public.receta_ingrediente (hogar_id, receta_id, ingrediente_id, cantidad, opcional, orden)
       values ($1, $2, $3, 100, true, 0), ($1, $2, $4, 10, false, 1), ($1, $2, $3, 50, false, 2), ($1, $2, $3, 5, true, 3)`,
      [h1, r, i1, i2],
    );
    await db.query("insert into public.paso_receta (hogar_id, receta_id, orden, texto) values ($1, $2, 0, 'a'), ($1, $2, 0, 'b'), ($1, $2, 3, 'c')", [h1, r]);
    const [{ id: ajena }] = (await db.query<{ id: string }>("insert into public.tienda (hogar_id, nombre) values ($1, 'Ajena') returning id", [h2])).rows;
    await db.query("insert into public.item_lista (hogar_id, texto, tienda_id) values ($1, 'Pan', $2)", [h1, ajena]);

    await aplicar(db, MIGRACIONES.slice(indice, indice + 1));

    const ri = await db.query("select ingrediente_id, cantidad::float c, opcional, orden from public.receta_ingrediente where receta_id = $1 order by orden", [r]);
    expect(ri.rows).toEqual([
      { ingrediente_id: i1, c: 155, opcional: false, orden: 0 },
      { ingrediente_id: i2, c: 10, opcional: false, orden: 1 },
    ]);
    // "a" y "b" tenían el mismo orden: quedan 0 y 1 (entre ellas, por id); "c" sigue la última.
    const pasos = await db.query<{ orden: number; texto: string }>("select orden, texto from public.paso_receta where receta_id = $1 order by orden", [r]);
    expect(pasos.rows.map((p) => p.orden)).toEqual([0, 1, 2]);
    expect(pasos.rows[2].texto).toBe("c");
    expect((await db.query("select tienda_id from public.item_lista where texto = 'Pan'")).rows).toEqual([{ tienda_id: null }]);
  }, 60_000);
});
