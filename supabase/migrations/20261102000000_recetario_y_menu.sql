-- Despensa · fase 2: recetario, menú semanal y lista generada desde el menú.

-- Raciones por defecto de cada franja del menú.
alter table public.hogar add column comensales smallint not null default 2 check (comensales between 1 and 20);

-- ---------------------------------------------------------------------------
-- Recetario
-- ---------------------------------------------------------------------------

create table public.receta (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 120),
  raciones smallint not null default 2 check (raciones between 1 and 50),
  tiempo_prep_min integer check (tiempo_prep_min >= 0),
  tiempo_coccion_min integer check (tiempo_coccion_min >= 0),
  -- "Sacar del congelador", "poner en remojo"… y con cuántas horas de antelación.
  preparacion_previa text,
  preparacion_previa_horas integer check (preparacion_previa_horas > 0),
  etiquetas text[] not null default '{}',
  valoracion smallint check (valoracion between 1 and 5),
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (hogar_id, id)
);
create index receta_hogar_idx on public.receta (hogar_id);

create table public.receta_ingrediente (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  receta_id uuid not null,
  ingrediente_id uuid not null,
  -- En la unidad base del ingrediente, para las raciones de la receta.
  cantidad numeric not null check (cantidad > 0),
  opcional boolean not null default false,
  orden smallint not null default 0,
  foreign key (hogar_id, receta_id) references public.receta (hogar_id, id) on delete cascade,
  foreign key (hogar_id, ingrediente_id) references public.ingrediente (hogar_id, id) on delete restrict
);
create index receta_ingrediente_receta_idx on public.receta_ingrediente (receta_id);
create index receta_ingrediente_ingrediente_idx on public.receta_ingrediente (ingrediente_id);

create table public.paso_receta (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  receta_id uuid not null,
  orden smallint not null,
  texto text not null check (char_length(trim(texto)) > 0),
  temporizador_seg integer check (temporizador_seg > 0),
  temporizador_nombre text,
  foreign key (hogar_id, receta_id) references public.receta (hogar_id, id) on delete cascade
);
create index paso_receta_receta_idx on public.paso_receta (receta_id, orden);

-- ---------------------------------------------------------------------------
-- Menú semanal: una fila por franja planificada (comida o cena de un día)
-- ---------------------------------------------------------------------------

create table public.franja_menu (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('comida', 'cena')),
  receta_id uuid,
  raciones smallint not null default 2 check (raciones between 1 and 50),
  fuera_de_casa boolean not null default false,
  -- Sobras de otra franja: no se cocina, y sus raciones se suman a las de la franja origen.
  es_sobra_de uuid,
  cocinado boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (hogar_id, id),
  unique (hogar_id, fecha, tipo),
  check (es_sobra_de is null or es_sobra_de <> id),
  foreign key (hogar_id, receta_id) references public.receta (hogar_id, id) on delete set null (receta_id),
  foreign key (hogar_id, es_sobra_de) references public.franja_menu (hogar_id, id) on delete set null (es_sobra_de)
);
create index franja_menu_hogar_fecha_idx on public.franja_menu (hogar_id, fecha);

-- Cantidad numérica de los elementos que genera la app (menú y stock mínimo), en unidad base del ingrediente.
alter table public.item_lista add column cantidad_base numeric check (cantidad_base > 0);

do $$
declare t text;
begin
  foreach t in array array['receta', 'receta_ingrediente', 'paso_receta', 'franja_menu'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Solo los miembros del hogar" on public.%I for all to authenticated '
      'using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id))', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Guardar una receta completa (cabecera, ingredientes y pasos) en una sola transacción.
-- security invoker: RLS se aplica con los permisos de quien llama.
-- ---------------------------------------------------------------------------

create function public.guardar_receta(p_receta jsonb, p_ingredientes jsonb, p_pasos jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_receta ->> 'id', '')::uuid;
  v_hogar uuid := (p_receta ->> 'hogar_id')::uuid;
begin
  if v_id is null then
    insert into public.receta (hogar_id, nombre) values (v_hogar, p_receta ->> 'nombre') returning id into v_id;
  end if;

  update public.receta set
    nombre = trim(p_receta ->> 'nombre'),
    raciones = (p_receta ->> 'raciones')::smallint,
    tiempo_prep_min = nullif(p_receta ->> 'tiempo_prep_min', '')::integer,
    tiempo_coccion_min = nullif(p_receta ->> 'tiempo_coccion_min', '')::integer,
    preparacion_previa = nullif(trim(p_receta ->> 'preparacion_previa'), ''),
    preparacion_previa_horas = nullif(p_receta ->> 'preparacion_previa_horas', '')::integer,
    etiquetas = coalesce(array(select jsonb_array_elements_text(p_receta -> 'etiquetas')), '{}'),
    valoracion = nullif(p_receta ->> 'valoracion', '')::smallint,
    notas = nullif(trim(p_receta ->> 'notas'), ''),
    actualizado_en = now()
  where id = v_id and hogar_id = v_hogar;
  if not found then
    raise exception 'Receta no encontrada';
  end if;

  delete from public.receta_ingrediente where receta_id = v_id;
  insert into public.receta_ingrediente (hogar_id, receta_id, ingrediente_id, cantidad, opcional, orden)
  select v_hogar, v_id, (i ->> 'ingrediente_id')::uuid, (i ->> 'cantidad')::numeric,
         coalesce((i ->> 'opcional')::boolean, false), (ord - 1)::smallint
  from jsonb_array_elements(p_ingredientes) with ordinality as t(i, ord);

  delete from public.paso_receta where receta_id = v_id;
  insert into public.paso_receta (hogar_id, receta_id, orden, texto, temporizador_seg, temporizador_nombre)
  select v_hogar, v_id, (ord - 1)::smallint, trim(p ->> 'texto'),
         nullif(p ->> 'temporizador_seg', '')::integer, nullif(trim(p ->> 'temporizador_nombre'), '')
  from jsonb_array_elements(p_pasos) with ordinality as t(p, ord);

  return v_id;
end;
$$;

revoke execute on function public.guardar_receta(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_receta(jsonb, jsonb, jsonb) to authenticated;

alter publication supabase_realtime add table public.franja_menu;
