-- ComePayá · límite de uso de las funciones de servidor (/api) por usuario y hora, para que nadie las use
-- como proxy (importar recetas) ni agote las fuentes externas. Solo la usa el servidor con la clave secreta.

create table public.uso_api (
  user_id uuid not null,
  uso text not null,
  hora timestamptz not null,
  veces int not null default 0,
  primary key (user_id, uso, hora)
);
-- Sin políticas: con RLS activo, nadie desde la app puede leerla ni escribirla (la clave secreta salta RLS).
alter table public.uso_api enable row level security;

/** Suma un uso en la hora actual y dice si sigue dentro del límite. Limpia lo de hace más de un día. */
create function public.contar_uso_api(p_usuario uuid, p_uso text, p_limite int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veces int;
begin
  insert into public.uso_api (user_id, uso, hora, veces)
  values (p_usuario, p_uso, date_trunc('hour', now()), 1)
  on conflict (user_id, uso, hora) do update set veces = public.uso_api.veces + 1
  returning veces into v_veces;
  delete from public.uso_api where hora < now() - interval '1 day';
  return v_veces <= p_limite;
end;
$$;

revoke execute on function public.contar_uso_api(uuid, text, int) from public, anon, authenticated;
grant execute on function public.contar_uso_api(uuid, text, int) to service_role;
