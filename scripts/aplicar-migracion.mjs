// Aplica migraciones de supabase/migrations a la base de datos de Supabase, cada una en una transacción.
//
// Uso (la contraseña la pones tú en tu terminal; el script nunca la muestra):
//   PowerShell:  $env:SUPABASE_DB_PASSWORD = "…";  npm run migrar -- supabase/migrations/20261110000000_menu_bebe.sql
//   Bash:        SUPABASE_DB_PASSWORD="…" npm run migrar -- supabase/migrations/20261110000000_menu_bebe.sql
//
// Con SUPABASE_DB_PASSWORD conecta a db.<proyecto>.supabase.co (el proyecto se saca de VITE_SUPABASE_URL en .env.local).
// Si tu red no tiene IPv6 y falla la conexión, usa en su lugar SUPABASE_DB_URL con la cadena del "Session pooler"
// (Supabase → Connect → Session pooler), con tu contraseña dentro.
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import postgres from "postgres";

const archivos = process.argv.slice(2);
if (!archivos.length) salir("Indica la migración: npm run migrar -- supabase/migrations/<archivo>.sql");
for (const a of archivos) if (!existsSync(a)) salir(`No existe ${a}`);

const url = process.env.SUPABASE_DB_URL ?? urlDirecta();
const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 15, onnotice: () => {} });

try {
  for (const archivo of archivos) {
    const contenido = readFileSync(archivo, "utf8");
    process.stdout.write(`Aplicando ${basename(archivo)}… `);
    try {
      // Todo o nada: si una sentencia falla, no queda nada a medias.
      await sql.begin((tx) => tx.unsafe(contenido));
      console.log("hecho.");
    } catch (error) {
      console.log("falló.");
      // ECONNREFUSED, ENOTFOUND, ENETUNREACH…: no llegó a conectar.
      if (/^E[A-Z]+$/.test(error.code ?? "")) {
        salir(
          `No se pudo conectar (${error.message}).` +
            (process.env.SUPABASE_DB_URL ? "" : " Si tu red no tiene IPv6, prueba con SUPABASE_DB_URL y la cadena del Session pooler."),
        );
      }
      // 42701/42P07/42710: columna, tabla o restricción que ya existe → probablemente ya estaba aplicada.
      const yaEstaba = ["42701", "42P07", "42710"].includes(error.code);
      salir(yaEstaba ? `Parece que ya estaba aplicada (${error.message}). No se ha cambiado nada.` : `${error.message}. No se ha cambiado nada.`);
    }
  }
} finally {
  await sql.end({ timeout: 5 });
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
