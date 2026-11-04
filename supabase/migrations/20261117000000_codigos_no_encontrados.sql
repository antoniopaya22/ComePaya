-- ComePayá · códigos de barras que no se han encontrado en ninguna fuente, para saber qué se escapa al escanear
-- y en qué mejorar el reconocimiento. No guarda quién lo escaneó: solo el código, cuántas veces y cuándo.
-- Solo la usa el servidor con la clave secreta.

create table public.ean_no_encontrado (
  ean text primary key,
  veces int not null default 1,
  primero timestamptz not null default now(),
  ultimo timestamptz not null default now()
);
-- Sin políticas: con RLS activo, nadie desde la app puede leerla ni escribirla (la clave secreta salta RLS).
alter table public.ean_no_encontrado enable row level security;

create function public.apuntar_ean_no_encontrado(p_ean text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ean_no_encontrado (ean) values (p_ean)
  on conflict (ean) do update set veces = public.ean_no_encontrado.veces + 1, ultimo = now();
$$;

revoke execute on function public.apuntar_ean_no_encontrado(text) from public, anon, authenticated;
grant execute on function public.apuntar_ean_no_encontrado(text) to service_role;
