-- ComePayá · unir ingredientes y cambiar su unidad en una sola transacción.
-- Antes se hacía paso a paso desde el móvil: si se cortaba la conexión a mitad, quedaban recetas convertidas
-- y lotes sin convertir. security invoker: RLS se aplica a quien llama.

-- Misma regla que convertir() en src/dominio/fusion.ts: redondeo a milésimas y nunca 0.
create function public.convertir_cantidad(p_cantidad numeric, p_factor numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select greatest(0.001, round(p_cantidad * p_factor, 3));
$$;

-- Recetas, productos (con sus lotes) y lista de p_origen pasan a p_destino con las cantidades por p_factor.
-- Con el mismo id solo convierte (cambio de unidad). Uso interno de las dos funciones de abajo.
create function public.pasar_referencias_ingrediente(p_hogar_id uuid, p_origen uuid, p_destino uuid, p_factor numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.receta_ingrediente
  set ingrediente_id = p_destino, cantidad = public.convertir_cantidad(cantidad, p_factor)
  where hogar_id = p_hogar_id and ingrediente_id = p_origen;

  -- Los lotes van en la unidad del ingrediente: se convierten con él.
  if p_factor <> 1 then
    update public.lote_despensa
    set cantidad = public.convertir_cantidad(cantidad, p_factor)
    where hogar_id = p_hogar_id
      and producto_id in (select id from public.producto where hogar_id = p_hogar_id and ingrediente_id = p_origen);
  end if;

  update public.producto
  set ingrediente_id = p_destino,
      cantidad_envase = case when p_factor <> 1 and cantidad_envase is not null
                             then public.convertir_cantidad(cantidad_envase, p_factor) else cantidad_envase end
  where hogar_id = p_hogar_id and ingrediente_id = p_origen;

  update public.item_lista
  set ingrediente_id = p_destino,
      cantidad_base = case when cantidad_base is not null then public.convertir_cantidad(cantidad_base, p_factor) end
  where hogar_id = p_hogar_id and ingrediente_id = p_origen;
end;
$$;

-- Une p_origen en p_destino: todo lo suyo pasa al destino, que hereda "siempre hay en casa" y la primera vez
-- que lo probó el bebé, y el origen se borra.
create function public.unir_ingredientes(p_origen uuid, p_destino uuid, p_factor numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  o public.ingrediente;
  d public.ingrediente;
begin
  select * into o from public.ingrediente where id = p_origen for update;
  select * into d from public.ingrediente where id = p_destino for update;
  if o.id is null or d.id is null then
    raise exception 'Ese ingrediente ya no existe';
  end if;
  if o.hogar_id <> d.hogar_id or not public.es_miembro(o.hogar_id) then
    raise exception 'No perteneces a este hogar';
  end if;
  if o.id = d.id then
    raise exception 'No se puede unir un ingrediente consigo mismo';
  end if;
  if p_factor is null or p_factor <= 0 then
    raise exception 'Factor de conversión no válido';
  end if;

  perform public.pasar_referencias_ingrediente(o.hogar_id, o.id, d.id, p_factor);

  update public.ingrediente
  set siempre_disponible = d.siempre_disponible or o.siempre_disponible,
      bebe_introducido = least(d.bebe_introducido, o.bebe_introducido)
  where id = d.id;

  delete from public.ingrediente where id = o.id;
end;
$$;

-- Cambia la unidad de un ingrediente que ya se usa (patatas en gramos → por unidades) y convierte recetas,
-- despensa, lista, stock mínimo y medidas caseras. p_peso_unidad: g o ml de una unidad, al pasar a unidades.
create function public.cambiar_unidad_ingrediente(p_ingrediente uuid, p_unidad text, p_factor numeric, p_peso_unidad numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i public.ingrediente;
begin
  select * into i from public.ingrediente where id = p_ingrediente for update;
  if i.id is null then
    raise exception 'Ese ingrediente ya no existe';
  end if;
  if not public.es_miembro(i.hogar_id) then
    raise exception 'No perteneces a este hogar';
  end if;
  if p_factor is null or p_factor <= 0 then
    raise exception 'Factor de conversión no válido';
  end if;
  if i.unidad_base = p_unidad then
    return;
  end if;

  perform public.pasar_referencias_ingrediente(i.hogar_id, i.id, i.id, p_factor);

  update public.ingrediente
  set unidad_base = p_unidad,
      peso_unidad_g = case when p_unidad = 'ud' then p_peso_unidad end,
      stock_minimo = case when stock_minimo > 0 then public.convertir_cantidad(stock_minimo, p_factor) end,
      equivalencias = case when equivalencias is not null then coalesce(
        (select jsonb_object_agg(e.key, public.convertir_cantidad(e.value::numeric, p_factor)) from jsonb_each_text(equivalencias) e),
        '{}'::jsonb) end
  where id = i.id;
end;
$$;

-- La auxiliar la llaman las otras con los permisos de quien llama, así que authenticated la necesita;
-- llamada a mano no salta nada: RLS solo le deja tocar filas de sus hogares.
revoke execute on function public.pasar_referencias_ingrediente(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.pasar_referencias_ingrediente(uuid, uuid, uuid, numeric) to authenticated;
revoke execute on function public.unir_ingredientes(uuid, uuid, numeric) from public, anon;
grant execute on function public.unir_ingredientes(uuid, uuid, numeric) to authenticated;
revoke execute on function public.cambiar_unidad_ingrediente(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.cambiar_unidad_ingrediente(uuid, text, numeric, numeric) to authenticated;
