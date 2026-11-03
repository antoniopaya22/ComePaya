# ComePayá

PWA para gestionar la despensa, la lista de la compra y el menú semanal de un hogar. Funciona como web en el ordenador y se instala como app en el móvil. Visión, decisiones y plan por fases en [SPEC.md](SPEC.md).

Stack: React + Vite + Tailwind en Vercel, Supabase (Postgres, login con Google, tiempo real). Todo en planes gratuitos.

## Qué hace

- **Hogares**: varias cuentas de Google comparten los mismos datos; se entra con un código de invitación.
- **Despensa**: lotes con ubicación y caducidad, consumido/tirado, raciones congeladas, avisos de caducidad.
- **Escáner**: escaneo continuo de códigos de barras; Open Food Facts, caché compartida y búsqueda en Mercadona por nombre; Nutri-Score, NOVA, semáforo y aditivos vigilados.
- **Recetas**: propias, con escalado de raciones, nutrientes por ración, modo cocina con temporizadores, exportar/importar en Markdown.
- **Menú**: comidas y cenas de la semana, sobras, "fuera de casa", equilibrio semanal frente a reglas (AESAN) y sugerencias explicables.
- **Lista**: por secciones en el orden de la tienda, generada desde el menú restando la despensa, compartida en tiempo real y usable sin conexión; lo comprado pasa a la despensa.
- **Recordatorios push**: preparación previa (remojos, descongelar) y caducidades. **Feed iCal** del menú. **Estadísticas** de desperdicio y equilibrio.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173 contra tu Supabase (.env.local); también sirve /api
npm run dev:demo   # http://localhost:5199 con una Supabase simulada y datos de ejemplo, sin cuentas
npm test           # tests de dominio (Vitest)
npm run test:e2e   # tests de pantalla (Playwright) contra el modo demo
npm run build      # comprobación de tipos + compilación
```

Cada push a `main` pasa por GitHub Actions ([ci.yml](.github/workflows/ci.yml)): tipos, tests, compilación y tests de pantalla. Los fallos que veáis en el móvil se pueden reportar desde *Ajustes → Reportar un problema* (abre un issue con los datos del dispositivo); los errores del navegador quedan además en la tabla `error_cliente`.

El código de dominio (`src/dominio/`) es TypeScript puro y es donde van los tests. `api/` son funciones de servidor que Vercel despliega solas; en desarrollo las sirve un plugin de Vite (las variables de servidor deben estar en el entorno de la terminal; sin ellas, la caché compartida simplemente no se usa).

## Puesta en marcha (una vez)

### 1. Supabase

1. Crea el proyecto (plan gratuito, región Europa). Deja activado **Enable Data API**. Puedes desactivar *Automatically expose new tables* y activar *Enable automatic RLS*: las migraciones ya dan los permisos y activan RLS.
2. Añade en GitHub el secreto `SUPABASE_DB_URL` (*Settings → Secrets and variables → Actions*): la cadena de conexión
   **Session pooler** de Supabase (*Connect → Session pooler*) con la contraseña de la base de datos, codificada para URL.
   Con él, cada push a `main` que traiga una migración nueva la aplica sola ([migraciones.yml](.github/workflows/migraciones.yml)),
   y en un proyecto vacío se aplican todas (lánzalo a mano la primera vez: *Actions → Migraciones → Run workflow*).
   Cada migración va en una transacción y queda apuntada en `control.migracion`: si algo falla, no cambia nada.
   Desde tu terminal: `$env:SUPABASE_DB_URL = "…"` (PowerShell) y `npm run migrar` (las que falten) o `npm run migrar -- <archivo>`.
   Las migraciones deben ser compatibles con el código anterior: Vercel despliega a la vez que se aplican.
3. En **Project Settings → API keys** copia la *publishable key* y la *secret key* (ver `.env.example`).

### 2. Login con Google

1. En [Google Cloud Console](https://console.cloud.google.com) → *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, y añade vuestros correos como usuarios de prueba (o publícala).
2. *Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web*. En **URIs de redirección autorizados** pon `https://<ref>.supabase.co/auth/v1/callback`.
3. En Supabase, **Authentication → Sign In / Providers → Google**: actívalo y pega el *Client ID* y el *Client Secret*.
4. En Supabase, **Authentication → URL Configuration**: *Site URL* = la URL de Vercel; *Redirect URLs* = `http://localhost:5173/**` y `https://*.vercel.app/**`.

### 3. Vercel

1. Importa el repositorio de GitHub en [vercel.com](https://vercel.com) (plan Hobby). Detecta Vite solo.
2. Variables de entorno: todas las de [.env.example](.env.example). Para las de push genera un par de claves con `npx web-push generate-vapid-keys`.
3. Cada push a `main` despliega; cada rama tiene su URL de prueba.

### 4. Recordatorios cada hora (pg_cron)

En Supabase → **Database → Extensions** activa `pg_cron` y `pg_net`. Después, en el SQL Editor (cambia la URL y el secreto por los tuyos, el mismo `CRON_SECRET` que en Vercel):

```sql
select cron.schedule(
  'recordatorios',
  '5 * * * *',
  $$ select net.http_post(
       url := 'https://TU-APP.vercel.app/api/recordatorios',
       headers := '{"x-cron-secret": "TU_CRON_SECRET"}'::jsonb
     ) $$
);
```

Cada miembro activa los avisos en su móvil desde *Ajustes → Avisos en este dispositivo*.

### 5. Copia de seguridad semanal

El workflow [.github/workflows/mantenimiento.yml](.github/workflows/mantenimiento.yml) vuelca la base de datos cada lunes y la guarda **cifrada** como artefacto 90 días; esa actividad además evita que Supabase pause el proyecto gratuito.

- Usa el mismo secreto `SUPABASE_DB_URL` que las migraciones (paso 1.2).
- El repositorio es público y cualquiera con cuenta de GitHub puede descargar sus artefactos: la copia solo se sube si existe el secreto `BACKUP_PASSPHRASE` (una contraseña larga que guardas tú), con la que se cifra (AES-256, gpg). Sin él, se vuelca pero no se sube.
- Para restaurarla: descarga el artefacto `copia-cifrada-N`, descomprime el zip y ejecuta
  `gpg -d copia.tar.gz.gpg | tar xz` (pide la contraseña); salen `copia/esquema.sql` y `copia/datos.sql`.
- GitHub desactiva los workflows programados de repositorios públicos sin actividad en 60 días.

## Usarla en el móvil

Abre la URL de Vercel en Chrome (Android) → menú ⋮ → **Instalar app**. Entra con Google, crea el hogar y comparte el código desde *Ajustes* para que el resto se una.
