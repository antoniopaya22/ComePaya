-- Despensa · fase 5: notificaciones push.

-- Una fila por dispositivo suscrito. Cada usuario gestiona las suyas.
create table public.suscripcion_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);
create index suscripcion_push_hogar_idx on public.suscripcion_push (hogar_id);

alter table public.suscripcion_push enable row level security;
create policy "Cada uno sus dispositivos" on public.suscripcion_push for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.es_miembro(hogar_id));
grant select, insert, update, delete on public.suscripcion_push to authenticated;

-- Avisos ya enviados, para no repetirlos. Solo la usa el servidor (sin políticas: nadie más la ve).
create table public.aviso_enviado (
  clave text primary key,
  enviado_en timestamptz not null default now()
);
alter table public.aviso_enviado enable row level security;

-- La programación horaria (pg_cron + pg_net) necesita la URL de la app y un secreto: ver README.
