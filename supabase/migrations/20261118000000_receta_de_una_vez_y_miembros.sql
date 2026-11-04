-- ComePayá · guardar una receta de una vez (sin duplicarla al reintentar) y quitar miembros de un hogar.
-- Compatible con el código anterior: sin id se crea como antes y sin foto_url/fuente_url no se tocan.

-- guardar_receta: el id lo puede generar el móvil, así que reintentar tras un fallo de red guarda la misma
-- receta en vez de crear otra. foto_url y fuente_url van en la misma transacción si vienen.
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

-- Un admin puede quitar a otro miembro (p. ej., si el código de invitación se ha filtrado).
create function public.quitar_miembro(p_hogar uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(p_hogar) then
    raise exception 'Solo un admin puede quitar miembros' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Para irte tú, usa «Salir de este hogar»';
  end if;
  delete from public.miembro where hogar_id = p_hogar and user_id = p_user;
end;
$$;
revoke execute on function public.quitar_miembro(uuid, uuid) from public, anon;
grant execute on function public.quitar_miembro(uuid, uuid) to authenticated;

-- Si sale el último admin y quedan miembros, el más antiguo pasa a admin: el hogar nunca se queda sin nadie
-- que pueda renombrarlo, regenerar el código o quitar miembros.
create function public.mantener_un_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.rol = 'admin' and not exists (select 1 from public.miembro where hogar_id = old.hogar_id and rol = 'admin') then
    update public.miembro set rol = 'admin'
    where hogar_id = old.hogar_id
      and user_id = (select user_id from public.miembro where hogar_id = old.hogar_id order by creado_en, user_id limit 1);
  end if;
  return null;
end;
$$;
revoke execute on function public.mantener_un_admin() from public, anon, authenticated;

create trigger mantener_un_admin after delete on public.miembro
  for each row execute function public.mantener_un_admin();
