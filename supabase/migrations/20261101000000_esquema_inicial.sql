-- Despensa · esquema inicial (fases 0 y 1)
-- Hogares multi-cuenta, despensa con lotes, ingredientes, productos, tiendas y lista de la compra.
-- Seguridad: Row Level Security. Solo los miembros de un hogar ven y editan sus filas.

-- ---------------------------------------------------------------------------
-- Hogares y miembros
-- ---------------------------------------------------------------------------

-- Código de invitación de 8 caracteres sin caracteres ambiguos (0/O, 1/I/L).
create function public.generar_codigo_invitacion()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

create table public.hogar (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  codigo_invitacion text not null unique default public.generar_codigo_invitacion(),
  creado_por uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.miembro (
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text,
  email text,
  rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
  creado_en timestamptz not null default now(),
  primary key (hogar_id, user_id)
);
create index miembro_user_id_idx on public.miembro (user_id);

-- security definer: evita la recursión de RLS al consultar miembro desde sus propias políticas.
create function public.es_miembro(p_hogar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembro m
    where m.hogar_id = p_hogar_id and m.user_id = (select auth.uid())
  );
$$;

create function public.es_admin(p_hogar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembro m
    where m.hogar_id = p_hogar_id and m.user_id = (select auth.uid()) and m.rol = 'admin'
  );
$$;

alter table public.hogar enable row level security;
alter table public.miembro enable row level security;

create policy "Los miembros ven su hogar" on public.hogar
  for select to authenticated using (public.es_miembro(id));
create policy "Los admin renombran su hogar" on public.hogar
  for update to authenticated using (public.es_admin(id)) with check (public.es_admin(id));

create policy "Los miembros ven a los demás miembros" on public.miembro
  for select to authenticated using (public.es_miembro(hogar_id));
create policy "Cada uno puede salir de un hogar" on public.miembro
  for delete to authenticated using (user_id = (select auth.uid()));
-- Las altas en hogar y miembro solo se hacen con las funciones crear_hogar y unirse_hogar.

-- ---------------------------------------------------------------------------
-- Catálogo compartido entre hogares (caché de datos externos por EAN)
-- Lo escriben las funciones de servidor con la clave secreta; los usuarios solo leen.
-- ---------------------------------------------------------------------------

create table public.catalogo_ean (
  ean text primary key check (ean ~ '^[0-9]{8,14}$'),
  nombre text,
  marca text,
  cantidad_texto text,
  foto_url text,
  nutrientes_100 jsonb,
  nutriscore text check (nutriscore in ('a', 'b', 'c', 'd', 'e')),
  nova smallint check (nova between 1 and 4),
  niveles_nutrientes jsonb,
  aditivos text[],
  completitud_datos numeric check (completitud_datos between 0 and 1),
  fuente text not null check (fuente in ('openfoodfacts', 'mercadona')),
  actualizado timestamptz not null default now()
);
alter table public.catalogo_ean enable row level security;
create policy "Cualquier usuario lee el catálogo" on public.catalogo_ean
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Datos del hogar
-- Las claves foráneas compuestas (hogar_id, id) impiden mezclar filas de hogares distintos.
-- ---------------------------------------------------------------------------

create table public.ingrediente (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  unidad_base text not null default 'g' check (unidad_base in ('g', 'ml', 'ud')),
  seccion_super text not null default 'Otros',
  grupo_alimento text,
  siempre_disponible boolean not null default false,
  stock_minimo numeric check (stock_minimo >= 0),
  caducidad_defecto_dias integer check (caducidad_defecto_dias > 0),
  nutrientes_100 jsonb,
  creado_en timestamptz not null default now(),
  unique (hogar_id, id)
);
create unique index ingrediente_nombre_unico on public.ingrediente (hogar_id, lower(nombre));

create table public.producto (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  ingrediente_id uuid not null,
  ean text check (ean ~ '^[0-9]{8,14}$'),
  nombre text not null check (char_length(trim(nombre)) between 1 and 120),
  marca text,
  -- En la unidad base del ingrediente (p. ej., lata de 400 g → 400).
  cantidad_envase numeric check (cantidad_envase > 0),
  fuente text not null default 'manual' check (fuente in ('openfoodfacts', 'mercadona', 'manual')),
  foto_url text,
  nutrientes_100 jsonb,
  nutriscore text check (nutriscore in ('a', 'b', 'c', 'd', 'e')),
  nova smallint check (nova between 1 and 4),
  niveles_nutrientes jsonb,
  aditivos text[],
  completitud_datos numeric check (completitud_datos between 0 and 1),
  caducidad_habitual_dias integer check (caducidad_habitual_dias > 0),
  creado_en timestamptz not null default now(),
  unique (hogar_id, id),
  unique (hogar_id, ean),
  foreign key (hogar_id, ingrediente_id) references public.ingrediente (hogar_id, id) on delete restrict
);
create index producto_ingrediente_idx on public.producto (ingrediente_id);

create table public.lote_despensa (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  producto_id uuid not null,
  -- En la unidad base del ingrediente del producto.
  cantidad numeric not null check (cantidad > 0),
  ubicacion text not null check (ubicacion in ('nevera', 'congelador', 'despensa')),
  fecha_caducidad date,
  creado_en timestamptz not null default now(),
  foreign key (hogar_id, producto_id) references public.producto (hogar_id, id) on delete cascade
);
create index lote_despensa_hogar_idx on public.lote_despensa (hogar_id, fecha_caducidad);

create table public.movimiento_despensa (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  producto_id uuid not null,
  cantidad numeric not null,
  tipo text not null check (tipo in ('alta', 'consumo', 'tirado', 'ajuste')),
  motivo text,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  foreign key (hogar_id, producto_id) references public.producto (hogar_id, id) on delete cascade
);
create index movimiento_despensa_hogar_idx on public.movimiento_despensa (hogar_id, creado_en desc);

create table public.tienda (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 60),
  orden_secciones text[] not null default '{}',
  creado_en timestamptz not null default now()
);
create index tienda_hogar_idx on public.tienda (hogar_id);

create table public.item_lista (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 120),
  -- Texto libre ("2 kg", "1 paquete"): la lista no hace aritmética de unidades en la fase 1.
  cantidad text,
  ingrediente_id uuid,
  seccion_super text not null default 'Otros',
  marcado boolean not null default false,
  origen text not null default 'manual' check (origen in ('manual', 'menu', 'stock_minimo')),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  foreign key (hogar_id, ingrediente_id) references public.ingrediente (hogar_id, id) on delete set null (ingrediente_id)
);
create index item_lista_hogar_idx on public.item_lista (hogar_id);

-- Misma política para todas las tablas del hogar.
do $$
declare t text;
begin
  foreach t in array array['ingrediente', 'producto', 'lote_despensa', 'movimiento_despensa', 'tienda', 'item_lista'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Solo los miembros del hogar" on public.%I for all to authenticated '
      'using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos explícitos (no depender de los privilegios por defecto del proyecto)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Alta de hogares
-- ---------------------------------------------------------------------------

-- Datos iniciales de un hogar nuevo: una tienda con el orden de secciones típico y los básicos.
create function public.sembrar_hogar(p_hogar_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tienda (hogar_id, nombre, orden_secciones) values (
    p_hogar_id, 'Mercadona',
    array['Fruta y verdura', 'Panadería', 'Carnicería', 'Pescadería', 'Charcutería y quesos',
          'Lácteos y huevos', 'Despensa', 'Conservas', 'Bebidas', 'Congelados', 'Droguería', 'Higiene', 'Otros']
  );
  insert into public.ingrediente (hogar_id, nombre, unidad_base, seccion_super, siempre_disponible) values
    (p_hogar_id, 'Sal', 'g', 'Despensa', true),
    (p_hogar_id, 'Aceite de oliva', 'ml', 'Despensa', true),
    (p_hogar_id, 'Pimienta negra', 'g', 'Despensa', true),
    (p_hogar_id, 'Ajo', 'ud', 'Fruta y verdura', true);
$$;
revoke execute on function public.sembrar_hogar(uuid) from public, anon, authenticated;

create function public.crear_hogar(p_nombre text)
returns public.hogar
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hogar public.hogar;
begin
  if v_user is null then
    raise exception 'No has iniciado sesión';
  end if;

  insert into public.hogar (nombre, creado_por) values (trim(p_nombre), v_user)
  returning * into v_hogar;

  insert into public.miembro (hogar_id, user_id, nombre, email, rol)
  select v_hogar.id, u.id,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         u.email, 'admin'
  from auth.users u where u.id = v_user;

  perform public.sembrar_hogar(v_hogar.id);
  return v_hogar;
end;
$$;

create function public.unirse_hogar(p_codigo text)
returns public.hogar
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_hogar public.hogar;
begin
  if v_user is null then
    raise exception 'No has iniciado sesión';
  end if;

  select * into v_hogar from public.hogar
  where codigo_invitacion = upper(replace(trim(p_codigo), ' ', ''));
  if not found then
    raise exception 'Código de invitación no válido';
  end if;

  insert into public.miembro (hogar_id, user_id, nombre, email, rol)
  select v_hogar.id, u.id,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         u.email, 'miembro'
  from auth.users u where u.id = v_user
  on conflict (hogar_id, user_id) do nothing;

  return v_hogar;
end;
$$;

-- Invalida el código anterior (por si se ha compartido con quien no debía).
create function public.regenerar_codigo_invitacion(p_hogar_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if not public.es_admin(p_hogar_id) then
    raise exception 'Solo un administrador del hogar puede cambiar el código';
  end if;
  update public.hogar set codigo_invitacion = public.generar_codigo_invitacion()
  where id = p_hogar_id
  returning codigo_invitacion into v_codigo;
  return v_codigo;
end;
$$;

revoke execute on function public.crear_hogar(text), public.unirse_hogar(text),
  public.regenerar_codigo_invitacion(uuid) from public, anon;
grant execute on function public.crear_hogar(text), public.unirse_hogar(text),
  public.regenerar_codigo_invitacion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tiempo real: la lista y la despensa se refrescan en todos los móviles del hogar
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.item_lista, public.lote_despensa;
