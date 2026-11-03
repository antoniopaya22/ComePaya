// Aplica las migraciones de supabase/migrations a la base de datos de Supabase, cada una en una transacción,
// y apunta las aplicadas en control.migracion (un esquema que la API de Supabase no expone).
//
// Uso (la contraseña la pones tú en tu terminal; el script nunca la muestra):
//   npm run migrar                                  aplica las que falten, en orden (lo que hace GitHub Actions)
//   npm run migrar -- supabase/migrations/<x>.sql   aplica solo esas
//   PowerShell:  $env:SUPABASE_DB_PASSWORD = "…"   (o SUPABASE_DB_URL con la cadena completa)
//
// Con SUPABASE_DB_PASSWORD conecta a db.<proyecto>.supabase.co (el proyecto se saca de VITE_SUPABASE_URL en .env.local).
// Si tu red no tiene IPv6 y falla la conexión, usa en su lugar SUPABASE_DB_URL con la cadena del "Session pooler"
// (Supabase → Connect → Session pooler), con tu contraseña dentro.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import postgres from "postgres";

const CARPETA = "supabase/migrations";
// Última migración que ya estaba aplicada a mano en producción antes de llevar el registro (2026-11-03).
// La primera vez que se crea el registro, las anteriores a esta (incluida) se apuntan como aplicadas sin repetirlas.
const APLICADAS_A_MANO_HASTA = "20261110000000_menu_bebe.sql";

const pedidas = process.argv.slice(2);
for (const a of pedidas) if (!existsSync(a)) salir(`No existe ${a}`);

const url = process.env.SUPABASE_DB_URL || urlDirecta();
const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 15, onnotice: () => {} });

try {
  await prepararRegistro().catch((error) => {
    if (esDeConexion(error)) salirSinConexion(error);
    throw error;
  });
  const aplicadas = new Set((await sql`select nombre from control.migracion`).map((f) => f.nombre));
  const archivos = pedidas.length
    ? pedidas
    : readdirSync(CARPETA)
        .filter((f) => f.endsWith(".sql") && !aplicadas.has(f))
        .sort()
        .map((f) => join(CARPETA, f));
  if (!archivos.length) console.log("No hay migraciones pendientes.");

  for (const archivo of archivos) {
    const nombre = basename(archivo);
    process.stdout.write(`Aplicando ${nombre}… `);
    try {
      // Todo o nada: si una sentencia falla, no queda nada a medias (ni el registro).
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(archivo, "utf8"));
        await tx`insert into control.migracion (nombre) values (${nombre}) on conflict (nombre) do nothing`;
      });
      console.log("hecho.");
    } catch (error) {
      console.log("falló.");
      if (esDeConexion(error)) salirSinConexion(error);
      // 42701/42P07/42710/42723: columna, tabla, restricción o función que ya existe → probablemente ya estaba aplicada.
      const yaEstaba = ["42701", "42P07", "42710", "42723"].includes(error.code);
      salir(yaEstaba ? `Parece que ya estaba aplicada (${error.message}). No se ha cambiado nada.` : `${error.message}. No se ha cambiado nada.`);
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}

/** Crea el registro si no existe. La primera vez decide qué estaba ya aplicado mirando la base de datos. */
async function prepararRegistro() {
  const [{ existe }] = await sql`select to_regclass('control.migracion') is not null as existe`;
  if (existe) return;
  const [{ base }] = await sql`select exists (
      select 1 from information_schema.columns where table_schema = 'public' and table_name = 'franja_menu' and column_name = 'para'
    ) as base`;
  const [{ vacia }] = await sql`select to_regclass('public.hogar') is null as vacia`;
  if (!base && !vacia) {
    salir(
      `La base de datos tiene parte del esquema pero no hasta ${APLICADAS_A_MANO_HASTA}. ` +
        "Aplica a mano las que falten con npm run migrar -- <archivo> y vuelve a lanzarlo.",
    );
  }
  const previas = base
    ? readdirSync(CARPETA)
        .filter((f) => f.endsWith(".sql") && f <= APLICADAS_A_MANO_HASTA)
        .sort()
    : [];
  await sql.begin(async (tx) => {
    await tx`create schema if not exists control`;
    await tx`revoke all on schema control from public`;
    await tx`create table control.migracion (nombre text primary key, aplicada_en timestamptz not null default now())`;
    for (const nombre of previas) await tx`insert into control.migracion (nombre) values (${nombre})`;
  });
  console.log(previas.length ? `Registro creado: ${previas.length} migraciones ya estaban aplicadas.` : "Registro creado en una base de datos vacía.");
}

// ECONNREFUSED, ENOTFOUND, ENETUNREACH…: no llegó a conectar.
function esDeConexion(error) {
  return /^E[A-Z]+$/.test(error.code ?? "");
}

function salirSinConexion(error) {
  salir(
    `No se pudo conectar (${error.message}).` +
      (process.env.SUPABASE_DB_URL ? "" : " Si tu red no tiene IPv6, prueba con SUPABASE_DB_URL y la cadena del Session pooler."),
  );
}

function urlDirecta() {
  const clave = process.env.SUPABASE_DB_PASSWORD;
  if (!clave) salir("Falta SUPABASE_DB_PASSWORD (o SUPABASE_DB_URL) en esta terminal.");
  const entorno = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  const proyecto = /VITE_SUPABASE_URL=\s*"?https:\/\/([a-z0-9]+)\.supabase\.co/.exec(entorno)?.[1];
  if (!proyecto) salir("No encuentro VITE_SUPABASE_URL en .env.local para saber el proyecto. Usa SUPABASE_DB_URL.");
  return `postgresql://postgres:${encodeURIComponent(clave)}@db.${proyecto}.supabase.co:5432/postgres`;
}

function salir(mensaje) {
  console.error(mensaje);
  process.exit(1);
}
