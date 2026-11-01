-- Despensa · errores de cliente, alérgenos, producto abierto, unidades de cocina
-- y cambios atómicos en la despensa.

-- ---------------------------------------------------------------------------
-- Errores del navegador (para depurar lo que falla en los móviles)
-- ---------------------------------------------------------------------------
create table public.error_cliente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  mensaje text not null,
  pila text,
  contexto text,
  ruta text,
  version text,
  agente text,
  creado_en timestamptz not null default now()
);
alter table public.error_cliente enable row level security;
create policy "Cada uno registra sus errores" on public.error_cliente for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Cada uno ve sus errores" on public.error_cliente for select to authenticated
  using (user_id = (select auth.uid()));
grant select, insert on public.error_cliente to authenticated;
grant all on public.error_cliente to service_role;

-- ---------------------------------------------------------------------------
-- Alérgenos (14 de declaración obligatoria en la UE, con las etiquetas de Open Food Facts: en:gluten…)
-- ---------------------------------------------------------------------------
alter table public.hogar add column alergenos text[] not null default '{}';
alter table public.ingrediente add column alergenos text[] not null default '{}';
alter table public.producto add column alergenos text[];
alter table public.catalogo_ean add column alergenos text[];

-- ---------------------------------------------------------------------------
-- Producto abierto: un envase abierto dura menos que lo que dice la fecha impresa
-- ---------------------------------------------------------------------------
alter table public.ingrediente add column dias_tras_abrir integer check (dias_tras_abrir > 0);
alter table public.lote_despensa add column abierto_en date;

-- Equivalencias de medidas caseras por ingrediente, en su unidad base: {"cucharada": 8, "vaso": 160}
alter table public.ingrediente add column equivalencias jsonb;

-- ---------------------------------------------------------------------------
-- Cambios de despensa en una sola transacción (cocinar, guardar la compra, escanear para sacar):
-- si algo falla, no queda nada a medias. security invoker: RLS se aplica a quien llama.
-- ---------------------------------------------------------------------------
create function public.aplicar_cambios_despensa(p_hogar_id uuid, p_cambios jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar';
  end if;

  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'lotes_crear', '[]')) loop
    insert into public.lote_despensa (hogar_id, producto_id, cantidad, ubicacion, fecha_caducidad, abierto_en)
    values (p_hogar_id, (v ->> 'producto_id')::uuid, (v ->> 'cantidad')::numeric, v ->> 'ubicacion',
            nullif(v ->> 'fecha_caducidad', '')::date, nullif(v ->> 'abierto_en', '')::date);
  end loop;

  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'lotes_actualizar', '[]')) loop
    update public.lote_despensa set
      cantidad = coalesce((v ->> 'cantidad')::numeric, cantidad),
      ubicacion = coalesce(v ->> 'ubicacion', ubicacion),
      fecha_caducidad = case when v ? 'fecha_caducidad' then nullif(v ->> 'fecha_caducidad', '')::date else fecha_caducidad end,
      abierto_en = case when v ? 'abierto_en' then nullif(v ->> 'abierto_en', '')::date else abierto_en end
    where id = (v ->> 'id')::uuid and hogar_id = p_hogar_id;
  end loop;

  -- Cambios relativos (+1 al escanear, −200 g al cocinar): se aplican sobre el valor actual, con el lote
  -- bloqueado, para que dos miembros a la vez no se pisen. Si el lote ya no existe, falla todo.
  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'lotes_delta', '[]')) loop
    perform 1 from public.lote_despensa where id = (v ->> 'id')::uuid and hogar_id = p_hogar_id for update;
    if not found then
      raise exception 'Ese lote ya no está en la despensa';
    end if;
    update public.lote_despensa set cantidad = cantidad + (v ->> 'delta')::numeric
    where id = (v ->> 'id')::uuid and cantidad + (v ->> 'delta')::numeric > 0.0001;
    if not found then
      delete from public.lote_despensa where id = (v ->> 'id')::uuid;
    end if;
  end loop;

  delete from public.lote_despensa
  where hogar_id = p_hogar_id
    and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_cambios -> 'lotes_borrar', '[]')) x);

  if p_cambios ? 'racion_congelada' then
    insert into public.racion_congelada (hogar_id, receta_id, descripcion, raciones)
    values (p_hogar_id, nullif(p_cambios #>> '{racion_congelada,receta_id}', '')::uuid,
            p_cambios #>> '{racion_congelada,descripcion}', (p_cambios #>> '{racion_congelada,raciones}')::smallint);
  end if;

  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'movimientos', '[]')) loop
    insert into public.movimiento_despensa (hogar_id, producto_id, cantidad, tipo, motivo)
    values (p_hogar_id, (v ->> 'producto_id')::uuid, (v ->> 'cantidad')::numeric, v ->> 'tipo', v ->> 'motivo');
  end loop;

  delete from public.item_lista
  where hogar_id = p_hogar_id
    and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_cambios -> 'items_borrar', '[]')) x);

  if nullif(p_cambios ->> 'franja_cocinada', '') is not null then
    update public.franja_menu set cocinado = true where id = (p_cambios ->> 'franja_cocinada')::uuid and hogar_id = p_hogar_id;
  end if;
end;
$$;

revoke execute on function public.aplicar_cambios_despensa(uuid, jsonb) from public, anon;
grant execute on function public.aplicar_cambios_despensa(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Avisos: un dispositivo (endpoint) es de quien lo activa por última vez, aunque antes fuera de otra
-- persona en el mismo navegador. RLS no permite reasignarlo desde el cliente, de ahí security definer.
-- ---------------------------------------------------------------------------
create function public.registrar_suscripcion_push(p_hogar_id uuid, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar';
  end if;
  delete from public.suscripcion_push where endpoint = p_endpoint;
  insert into public.suscripcion_push (user_id, hogar_id, endpoint, p256dh, auth)
  values (auth.uid(), p_hogar_id, p_endpoint, p_p256dh, p_auth);
end;
$$;

revoke execute on function public.registrar_suscripcion_push(uuid, text, text, text) from public, anon;
grant execute on function public.registrar_suscripcion_push(uuid, text, text, text) to authenticated;
