-- Despensa · fase 3: escaneo con caché compartida y Mercadona.

-- Contenido del envase normalizado (g o ml) para no volver a interpretar el texto de la fuente.
alter table public.catalogo_ean
  add column cantidad_envase numeric check (cantidad_envase > 0),
  add column unidad_envase text check (unidad_envase in ('g', 'ml')),
  add column mercadona_id text;

alter table public.producto add column mercadona_id text;
