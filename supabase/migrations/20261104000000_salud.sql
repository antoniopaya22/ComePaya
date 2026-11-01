-- Despensa · fase 4: salud y equilibrio semanal.

-- Peso de una unidad (un huevo ≈ 60 g) para calcular nutrientes de ingredientes que se cuentan por unidades.
alter table public.ingrediente add column peso_unidad_g numeric check (peso_unidad_g > 0);

-- Aditivos que el hogar quiere vigilar (E-números, p. ej. {E250,E621}).
alter table public.hogar add column aditivos_vigilados text[] not null default '{}';

-- Reglas de equilibrio: cuántas comidas o cenas a la semana con cada grupo de alimentos (§8.3).
-- Si un hogar no tiene filas, la app usa unas reglas por defecto tomadas de las recomendaciones de la AESAN.
create table public.regla_semanal (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  grupo_alimento text not null,
  minimo_semana smallint check (minimo_semana >= 0),
  maximo_semana smallint check (maximo_semana >= 0),
  unique (hogar_id, grupo_alimento),
  check (minimo_semana is null or maximo_semana is null or minimo_semana <= maximo_semana)
);

alter table public.regla_semanal enable row level security;
create policy "Solo los miembros del hogar" on public.regla_semanal for all to authenticated
  using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id));
grant select, insert, update, delete on public.regla_semanal to authenticated;
