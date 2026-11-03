-- ComePayá · altas de despensa y "Completar desde el menú" de una vez, y que se puedan deshacer.

-- ---------------------------------------------------------------------------
-- aplicar_cambios_despensa (misma firma): lotes_crear admite el id del lote, generado en el móvil, para que el
-- alta (lote + movimiento) vaya en una transacción y se sepa exactamente qué deshacer. El resto, igual que en 20261112.
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_cambios_despensa(p_hogar_id uuid, p_cambios jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v jsonb;
  v_pedidos int;
  v_borrados int;
begin
  if not public.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar';
  end if;

  if nullif(p_cambios ->> 'franja_cocinada', '') is not null then
    update public.franja_menu set cocinado = true
    where id = (p_cambios ->> 'franja_cocinada')::uuid and hogar_id = p_hogar_id and not cocinado;
    if not found then
      raise exception 'Este plato ya está marcado como cocinado (quizá desde otro móvil)';
    end if;
  end if;

  v_pedidos := jsonb_array_length(coalesce(p_cambios -> 'items_borrar', '[]'));
  if v_pedidos > 0 then
    delete from public.item_lista
    where hogar_id = p_hogar_id
      and id in (select (x #>> '{}')::uuid from jsonb_array_elements(p_cambios -> 'items_borrar') x);
    get diagnostics v_borrados = row_count;
    if v_borrados < v_pedidos then
      raise exception 'La lista ha cambiado desde otro móvil (quizá ya se guardó esta compra): revísala y vuelve a intentarlo';
    end if;
  end if;

  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'lotes_crear', '[]')) loop
    insert into public.lote_despensa (id, hogar_id, producto_id, cantidad, ubicacion, fecha_caducidad, abierto_en)
    values (coalesce(nullif(v ->> 'id', '')::uuid, gen_random_uuid()), p_hogar_id, (v ->> 'producto_id')::uuid, (v ->> 'cantidad')::numeric, v ->> 'ubicacion',
            nullif(v ->> 'fecha_caducidad', '')::date, nullif(v ->> 'abierto_en', '')::date);
  end loop;

  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'lotes_actualizar', '[]')) loop
    update public.lote_despensa set
      cantidad = coalesce((v ->> 'cantidad')::numeric, cantidad),
      ubicacion = coalesce(v ->> 'ubicacion', ubicacion),
      fecha_caducidad = case when v ? 'fecha_caducidad' then nullif(v ->> 'fecha_caducidad', '')::date else fecha_caducidad end,
      abierto_en = case when v ? 'abierto_en' then nullif(v ->> 'abierto_en', '')::date else abierto_en end
    where id = (v ->> 'id')::uuid and hogar_id = p_hogar_id;
    if not found then
      raise exception 'Ese lote ya no está en la despensa';
    end if;
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

  v_pedidos := jsonb_array_length(coalesce(p_cambios -> 'lotes_borrar', '[]'));
  if v_pedidos > 0 then
    delete from public.lote_despensa
    where hogar_id = p_hogar_id
      and id in (select (x #>> '{}')::uuid from jsonb_array_elements(p_cambios -> 'lotes_borrar') x);
    get diagnostics v_borrados = row_count;
    if v_borrados < v_pedidos then
      raise exception 'Ese lote ya no está en la despensa';
    end if;
  end if;

  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'raciones_delta', '[]')) loop
    perform 1 from public.racion_congelada where id = (v ->> 'id')::uuid and hogar_id = p_hogar_id for update;
    if not found then
      raise exception 'Esa ración ya no está en el congelador';
    end if;
    update public.racion_congelada set raciones = raciones + (v ->> 'delta')::int
    where id = (v ->> 'id')::uuid and raciones + (v ->> 'delta')::int > 0;
    if not found then
      delete from public.racion_congelada where id = (v ->> 'id')::uuid;
    end if;
  end loop;

  if p_cambios ? 'racion_congelada' then
    insert into public.racion_congelada (hogar_id, receta_id, descripcion, raciones)
    values (p_hogar_id, nullif(p_cambios #>> '{racion_congelada,receta_id}', '')::uuid,
            p_cambios #>> '{racion_congelada,descripcion}', (p_cambios #>> '{racion_congelada,raciones}')::smallint);
  end if;

  for v in select * from jsonb_array_elements(coalesce(p_cambios -> 'movimientos', '[]')) loop
    insert into public.movimiento_despensa (hogar_id, producto_id, cantidad, tipo, motivo)
    values (p_hogar_id, (v ->> 'producto_id')::uuid, (v ->> 'cantidad')::numeric, v ->> 'tipo', v ->> 'motivo');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- aplicar_cambios_lista: los elementos automáticos de la lista (desde el menú y el stock mínimo), en una
-- transacción y de uno en uno por hogar (si dos móviles completan a la vez, el segundo espera y no duplica).
--  * p_crear: filas con id; no se crea si ya hay pendiente un automático de ese ingrediente.
--  * p_actualizar: { id, cantidad, cantidad_base, origen } de filas que existan.
--  * p_borrar: ids.
-- También sirve para deshacer: se crean de nuevo las quitadas, se vuelven a sus valores las cambiadas y se
-- borran las creadas.
-- ---------------------------------------------------------------------------
create function public.aplicar_cambios_lista(p_hogar_id uuid, p_crear jsonb, p_actualizar jsonb, p_borrar jsonb)
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
  perform pg_advisory_xact_lock(hashtext('lista:' || p_hogar_id::text));

  delete from public.item_lista
  where hogar_id = p_hogar_id
    and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_borrar, '[]')) x);

  for v in select * from jsonb_array_elements(coalesce(p_actualizar, '[]')) loop
    update public.item_lista set
      cantidad = v ->> 'cantidad',
      cantidad_base = nullif(v ->> 'cantidad_base', '')::numeric,
      origen = coalesce(v ->> 'origen', origen)
    where id = (v ->> 'id')::uuid and hogar_id = p_hogar_id;
  end loop;

  for v in select * from jsonb_array_elements(coalesce(p_crear, '[]')) loop
    if nullif(v ->> 'ingrediente_id', '') is not null and (v ->> 'origen') <> 'manual' and exists (
      select 1 from public.item_lista
      where hogar_id = p_hogar_id and ingrediente_id = (v ->> 'ingrediente_id')::uuid and origen <> 'manual' and not marcado
    ) then
      continue;
    end if;
    insert into public.item_lista (id, hogar_id, texto, cantidad, cantidad_base, ingrediente_id, seccion_super, origen, marcado)
    values ((v ->> 'id')::uuid, p_hogar_id, v ->> 'texto', v ->> 'cantidad', nullif(v ->> 'cantidad_base', '')::numeric,
            nullif(v ->> 'ingrediente_id', '')::uuid, v ->> 'seccion_super', coalesce(v ->> 'origen', 'manual'),
            coalesce((v ->> 'marcado')::boolean, false))
    on conflict (id) do nothing;
  end loop;
end;
$$;

revoke execute on function public.aplicar_cambios_lista(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.aplicar_cambios_lista(uuid, jsonb, jsonb, jsonb) to authenticated;
