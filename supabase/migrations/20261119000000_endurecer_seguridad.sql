-- ComePayá · endurecer la seguridad: código de invitación criptográfico y con límite de intentos, avisos push
-- solo hacia servicios de push conocidos, columnas editables del hogar y autoría que no se puede falsear.

-- ---------------------------------------------------------------------------
-- Código de invitación: azar criptográfico (gen_random_uuid) en vez de random(). Mismo formato: 8 caracteres
-- sin ambiguos. Se descartan los bytes ≥ 248 (= 31 × 8) para que todos los caracteres salgan igual de a menudo.
-- ---------------------------------------------------------------------------
create or replace function public.generar_codigo_invitacion()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo text := '';
  v_bytes bytea;
  v_byte int;
  i int;
begin
  while char_length(v_codigo) < 8 loop
    v_bytes := uuid_send(gen_random_uuid());
    -- Los bytes 6 y 8 llevan la versión y la variante del UUID: no son azar.
    foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15] loop
      v_byte := get_byte(v_bytes, i);
      if v_byte < 248 and char_length(v_codigo) < 8 then
        v_codigo := v_codigo || substr(v_alfabeto, 1 + v_byte % 31, 1);
      end if;
    end loop;
  end loop;
  return v_codigo;
end;
$$;

-- Intentos fallidos de unirse a un hogar, para frenar a quien pruebe códigos al azar. Solo el servidor la ve.
create table public.intento_union (
  user_id uuid not null,
  en timestamptz not null default now()
);
create index intento_union_user_idx on public.intento_union (user_id, en);
alter table public.intento_union enable row level security;

-- Un código que no existe ya no lanza error (eso desharía el registro del intento): devuelve null y la app
-- dice que no es válido. Con 10 fallos en una hora, se rechaza todo hasta que pase.
create or replace function public.unirse_hogar(p_codigo text)
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

  delete from public.intento_union where user_id = v_user and en < now() - interval '1 day';
  if (select count(*) from public.intento_union where user_id = v_user and en > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiados intentos con códigos que no existen. Prueba otra vez dentro de una hora.';
  end if;

  select * into v_hogar from public.hogar
  where codigo_invitacion = upper(replace(trim(p_codigo), ' ', ''));
  if not found then
    insert into public.intento_union (user_id) values (v_user);
    return null;
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

-- ---------------------------------------------------------------------------
-- Hogar: desde la app solo se editan estas columnas. El código de invitación y el token iCal solo cambian
-- con sus funciones (regenerar_*), que los generan con azar suficiente.
-- ---------------------------------------------------------------------------
revoke update on public.hogar from anon, authenticated;
grant update (nombre, comensales, aditivos_vigilados, alergenos, bebe_nombre) on public.hogar to authenticated;

-- ---------------------------------------------------------------------------
-- Avisos push: solo hacia servicios de push conocidos (Chrome/Android, Firefox, Edge/Windows, Safari), para
-- que nadie pueda hacer que el servidor mande peticiones a otra dirección. Se quitan las que no lo cumplan.
-- La misma lista está en src/dominio/recordatorios.ts (endpointPushPermitido).
-- ---------------------------------------------------------------------------
delete from public.suscripcion_push
where endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/';
alter table public.suscripcion_push add constraint suscripcion_push_endpoint_conocido
  check (endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/'
         and char_length(endpoint) <= 1000);

-- ---------------------------------------------------------------------------
-- Autoría: quién apuntó algo lo pone la base de datos, no el móvil, y no se cambia después.
-- Sin sesión (servidor con la clave secreta) se respeta lo que venga.
-- ---------------------------------------------------------------------------
create function public.fijar_autor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_columna text := tg_argv[0];
  v_user uuid := auth.uid();
  v_valor uuid;
begin
  if tg_op = 'UPDATE' then
    v_valor := (to_jsonb(old) ->> v_columna)::uuid;
  elsif v_user is not null then
    v_valor := v_user;
  else
    return new;
  end if;
  return jsonb_populate_record(new, jsonb_build_object(v_columna, v_valor));
end;
$$;
revoke execute on function public.fijar_autor() from public, anon, authenticated;

create trigger fijar_autor before insert or update on public.item_lista
  for each row execute function public.fijar_autor('creado_por');
create trigger fijar_autor before insert or update on public.movimiento_despensa
  for each row execute function public.fijar_autor('user_id');
create trigger fijar_autor before insert or update on public.rechazo_sugerencia
  for each row execute function public.fijar_autor('user_id');
