# ComePayá

App doméstica para gestionar despensa, lista de la compra y menú semanal (comidas y cenas), con escaneo de códigos de barras e información nutricional.

## Antes de empezar
- Lee `SPEC.md` completo: visión, decisiones, modelo de datos, fuentes externas y plan por fases.
- Lo marcado como "propuesto" en `SPEC.md` no está decidido: confírmalo con el usuario antes de implementarlo.

## Proyecto
- PWA React + Vite + Tailwind (Vercel) con Supabase. Puesta en marcha en `README.md`.
- `npm test` (Vitest), `npm run build` (tipos + compilación), `npm run dev`.
- `src/dominio/`: lógica pura sin React ni Supabase; aquí van los tests.
- `src/features/<módulo>/`: pantallas. `src/components/ui/`: componentes base.
- `api/`: funciones de servidor de Vercel (exportan `GET(request)`); en desarrollo las sirve un plugin de `vite.config.ts`.
  Vercel las ejecuta como ES modules sin empaquetar: en `api/` y `src/dominio/` los imports relativos llevan `.js` (`./caducidad.js`) y no usan `@/`. Lo comprueba `api/_lib/importaciones.test.ts`.
- `supabase/migrations/`: esquema real. Toda tabla del hogar lleva `hogar_id` y la política RLS `es_miembro(hogar_id)`. Los tipos de `src/lib/tipos.ts` se mantienen a mano.

## Forma de trabajar
- Avanza fase a fase según `SPEC.md` §11; cada fase debe dejar la app usable.
- Mantén `SPEC.md` actualizado cuando cambien decisiones o el modelo de datos.
- Interfaz en español, diseño mobile-first.
- Escribe tests para la lógica de dominio crítica (lista de la compra, unidades, raciones, puntuación de recetas).
