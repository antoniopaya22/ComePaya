-- ComePayá · dos móviles a la vez: sin compras ni platos cocinados por duplicado, sin guardar sobre lotes
-- que otro ya ha quitado, raciones congeladas con cambios relativos y tiempo real en el resto de tablas.

-- ---------------------------------------------------------------------------
-- aplicar_cambios_despensa (misma firma). Cambios respecto a 20261109:
--  * franja_cocinada: solo si no lo estaba ya; si otro la acaba de marcar, falla todo (no se descuenta dos veces).
--  * items_borrar: si falta alguno (otro ya guardó la compra), falla todo (no se duplica la despensa).
--  * lotes_actualizar y lotes_borrar: fallan si el lote ya no existe, como ya hacía lotes_delta.
--  * raciones_delta: suma o resta raciones congeladas sobre el valor actual; en 0 o menos, la ración se quita.
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
-- Tiempo real: lo que cambia otro miembro en estas tablas también se ve al momento
-- (ajustes del hogar y comensales, miembros, productos, tiendas, reglas y "no me apetece").
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.hogar, public.miembro, public.producto, public.tienda, public.regla_semanal, public.rechazo_sugerencia;
