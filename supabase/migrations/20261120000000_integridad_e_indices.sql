-- ComePayá · integridad y rendimiento: el súper de un artículo es del mismo hogar, una receta no repite
-- ingrediente ni orden de paso, índices en las claves ajenas y en lo que filtran los recordatorios, y
-- error_cliente con tamaño y ritmo acotados (el plan gratuito tiene 500 MB).

-- ---------------------------------------------------------------------------
-- item_lista.tienda_id: clave compuesta (hogar_id, id) como el resto, para no apuntar al súper de otro hogar.
-- ---------------------------------------------------------------------------
alter table public.tienda add constraint tienda_hogar_id_id_key unique (hogar_id, id);

update public.item_lista i set tienda_id = null
where tienda_id is not null
  and not exists (select 1 from public.tienda t where t.id = i.tienda_id and t.hogar_id = i.hogar_id);

alter table public.item_lista drop constraint item_lista_tienda_id_fkey;
alter table public.item_lista add constraint item_lista_tienda_fkey
  foreign key (hogar_id, tienda_id) references public.tienda (hogar_id, id) on delete set null (tienda_id);

-- ---------------------------------------------------------------------------
-- Una receta no repite ingrediente: las líneas repetidas se juntan (suman cantidad; opcional solo si
-- lo eran todas) y se quedan en el sitio de la primera.
-- ---------------------------------------------------------------------------
create temporary table repetidos on commit drop as
select receta_id, ingrediente_id, sum(cantidad) as cantidad, bool_and(opcional) as opcional, min(orden) as orden,
       (array_agg(id order by orden, id))[1] as queda
from public.receta_ingrediente
group by receta_id, ingrediente_id
having count(*) > 1;

update public.receta_ingrediente ri
set cantidad = r.cantidad, opcional = r.opcional, orden = r.orden
from repetidos r where ri.id = r.queda;

delete from public.receta_ingrediente ri
using repetidos r
where ri.receta_id = r.receta_id and ri.ingrediente_id = r.ingrediente_id and ri.id <> r.queda;

alter table public.receta_ingrediente add constraint receta_ingrediente_receta_ingrediente_key unique (receta_id, ingrediente_id);
-- El índice único empieza por receta_id: el anterior sobra.
drop index public.receta_ingrediente_receta_idx;

-- Los pasos de una receta, numerados sin repetir.
update public.paso_receta p set orden = n.nuevo
from (select id, (row_number() over (partition by receta_id order by orden, id) - 1)::smallint as nuevo from public.paso_receta) n
where p.id = n.id and p.orden <> n.nuevo;
alter table public.paso_receta add constraint paso_receta_receta_orden_key unique (receta_id, orden);
drop index public.paso_receta_receta_idx;

-- guardar_receta: si el editor trae dos líneas del mismo ingrediente, se guardan juntas (igual que arriba).
create or replace function public.guardar_receta(p_receta jsonb, p_ingredientes jsonb, p_pasos jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce(nullif(p_receta ->> 'id', '')::uuid, gen_random_uuid());
  v_hogar uuid := (p_receta ->> 'hogar_id')::uuid;
begin
  insert into public.receta (id, hogar_id, nombre) values (v_id, v_hogar, p_receta ->> 'nombre')
  on conflict (id) do nothing;

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
    foto_url = case when p_receta ? 'foto_url' then nullif(p_receta ->> 'foto_url', '') else foto_url end,
    fuente_url = case when p_receta ? 'fuente_url' then nullif(p_receta ->> 'fuente_url', '') else fuente_url end,
    actualizado_en = now()
  where id = v_id and hogar_id = v_hogar;
  if not found then
    raise exception 'Receta no encontrada';
  end if;

  delete from public.receta_ingrediente where receta_id = v_id;
  insert into public.receta_ingrediente (hogar_id, receta_id, ingrediente_id, cantidad, opcional, orden)
  select v_hogar, v_id, l.ingrediente_id, sum(l.cantidad), bool_and(l.opcional),
         (row_number() over (order by min(l.ord)) - 1)::smallint
  from (
    select (i ->> 'ingrediente_id')::uuid as ingrediente_id, (i ->> 'cantidad')::numeric as cantidad,
           coalesce((i ->> 'opcional')::boolean, false) as opcional, ord
    from jsonb_array_elements(p_ingredientes) with ordinality as t(i, ord)
  ) l
  group by l.ingrediente_id;

  delete from public.paso_receta where receta_id = v_id;
  insert into public.paso_receta (hogar_id, receta_id, orden, texto, temporizador_seg, temporizador_nombre)
  select v_hogar, v_id, (ord - 1)::smallint, trim(p ->> 'texto'),
         nullif(p ->> 'temporizador_seg', '')::integer, nullif(trim(p ->> 'temporizador_nombre'), '')
  from jsonb_array_elements(p_pasos) with ordinality as t(p, ord);

  return v_id;
end;
$$;

-- Al unir dos ingredientes, una receta que llevaba los dos se queda con una línea que suma ambas.
create or replace function public.pasar_referencias_ingrediente(p_hogar_id uuid, p_origen uuid, p_destino uuid, p_factor numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_origen <> p_destino then
    update public.receta_ingrediente d
    set cantidad = d.cantidad + public.convertir_cantidad(o.cantidad, p_factor),
        opcional = d.opcional and o.opcional
    from public.receta_ingrediente o
    where o.hogar_id = p_hogar_id and o.ingrediente_id = p_origen
      and d.receta_id = o.receta_id and d.ingrediente_id = p_destino;

    delete from public.receta_ingrediente o
    using public.receta_ingrediente d
    where o.hogar_id = p_hogar_id and o.ingrediente_id = p_origen
      and d.receta_id = o.receta_id and d.ingrediente_id = p_destino;
  end if;

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

-- ---------------------------------------------------------------------------
-- Índices en las claves ajenas (borrados en cascada y set null) y en lo que filtran los recordatorios,
-- que miran todos los hogares a la vez por fecha.
-- ---------------------------------------------------------------------------
create index lote_despensa_producto_idx on public.lote_despensa (producto_id);
create index lote_despensa_caducidad_idx on public.lote_despensa (fecha_caducidad) where fecha_caducidad is not null;
create index movimiento_despensa_producto_idx on public.movimiento_despensa (producto_id);
create index item_lista_ingrediente_idx on public.item_lista (hogar_id, ingrediente_id) where ingrediente_id is not null;
create index item_lista_tienda_idx on public.item_lista (tienda_id) where tienda_id is not null;
create index franja_menu_receta_idx on public.franja_menu (receta_id) where receta_id is not null;
create index franja_menu_sobra_idx on public.franja_menu (es_sobra_de) where es_sobra_de is not null;
create index franja_menu_fecha_idx on public.franja_menu (fecha);
create index racion_congelada_receta_idx on public.racion_congelada (receta_id) where receta_id is not null;
create index rechazo_sugerencia_receta_idx on public.rechazo_sugerencia (receta_id);
create index suscripcion_push_user_idx on public.suscripcion_push (user_id);
create index aviso_enviado_fecha_idx on public.aviso_enviado (enviado_en);

-- ---------------------------------------------------------------------------
-- error_cliente: textos acotados (la app ya los recorta; esto es para quien escriba directamente) y como
-- mucho 200 por usuario y día: los que pasen se descartan sin error. Lo antiguo lo purga /api/recordatorios.
-- ---------------------------------------------------------------------------
alter table public.error_cliente add constraint error_cliente_tamanos check (
  char_length(mensaje) <= 1000 and char_length(pila) <= 8000 and char_length(contexto) <= 500
  and char_length(ruta) <= 500 and char_length(version) <= 100 and char_length(agente) <= 500
) not valid;
create index error_cliente_user_idx on public.error_cliente (user_id, creado_en);
create index error_cliente_fecha_idx on public.error_cliente (creado_en);

create function public.limitar_errores_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.error_cliente where user_id = new.user_id and creado_en > now() - interval '1 day') >= 200 then
    return null;
  end if;
  return new;
end;
$$;
revoke execute on function public.limitar_errores_cliente() from public, anon, authenticated;

create trigger limitar_errores_cliente before insert on public.error_cliente
  for each row execute function public.limitar_errores_cliente();
