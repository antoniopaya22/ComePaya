-- ComePayá · el enlace del calendario (feed iCal) se puede cambiar: el anterior deja de funcionar.
create function public.regenerar_token_ical(p_hogar_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.es_admin(p_hogar_id) then
    raise exception 'Solo un administrador del hogar puede cambiar el enlace del calendario';
  end if;
  update public.hogar set ical_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  where id = p_hogar_id
  returning ical_token into v_token;
  return v_token;
end;
$$;

revoke execute on function public.regenerar_token_ical(uuid) from public, anon;
grant execute on function public.regenerar_token_ical(uuid) to authenticated;
