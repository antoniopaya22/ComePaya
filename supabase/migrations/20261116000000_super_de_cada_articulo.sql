-- ComePayá · cada cosa de la lista puede ser de un súper (Mercadona, Carrefour…) o de cualquiera (null).
-- En la lista se elige el súper y se ve lo suyo más lo de cualquiera, en el orden de sus pasillos.
-- Si se borra el súper, lo suyo pasa a "cualquiera".

alter table public.item_lista add column tienda_id uuid references public.tienda (id) on delete set null;

-- aplicar_cambios_lista (misma firma): al crear (también al deshacer) se conserva el súper.
create or replace function public.aplicar_cambios_lista(p_hogar_id uuid, p_crear jsonb, p_actualizar jsonb, p_borrar jsonb)
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
    insert into public.item_lista (id, hogar_id, texto, cantidad, cantidad_base, ingrediente_id, seccion_super, origen, marcado, tienda_id)
    values ((v ->> 'id')::uuid, p_hogar_id, v ->> 'texto', v ->> 'cantidad', nullif(v ->> 'cantidad_base', '')::numeric,
            nullif(v ->> 'ingrediente_id', '')::uuid, v ->> 'seccion_super', coalesce(v ->> 'origen', 'manual'),
            coalesce((v ->> 'marcado')::boolean, false), nullif(v ->> 'tienda_id', '')::uuid)
    on conflict (id) do nothing;
  end loop;
end;
$$;
