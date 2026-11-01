-- Despensa · fases 6 y 7: rechazos de sugerencias, raciones congeladas y feed iCal.

-- "No me apetece": se guarda desde el principio para afinar las sugerencias (§9.2).
create table public.rechazo_sugerencia (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  receta_id uuid not null,
  fecha date not null default current_date,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  foreign key (hogar_id, receta_id) references public.receta (hogar_id, id) on delete cascade
);
create index rechazo_sugerencia_hogar_idx on public.rechazo_sugerencia (hogar_id, fecha desc);

-- Raciones de comida ya cocinada guardadas en el congelador (§4.1).
create table public.racion_congelada (
  id uuid primary key default gen_random_uuid(),
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  receta_id uuid,
  descripcion text not null check (char_length(trim(descripcion)) between 1 and 120),
  raciones smallint not null check (raciones > 0),
  fecha_congelacion date not null default current_date,
  creado_en timestamptz not null default now(),
  foreign key (hogar_id, receta_id) references public.receta (hogar_id, id) on delete set null (receta_id)
);
create index racion_congelada_hogar_idx on public.racion_congelada (hogar_id);

do $$
declare t text;
begin
  foreach t in array array['rechazo_sugerencia', 'racion_congelada'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Solo los miembros del hogar" on public.%I for all to authenticated '
      'using (public.es_miembro(hogar_id)) with check (public.es_miembro(hogar_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Token secreto del feed iCal del menú (§4.4): quien tenga la URL puede leer el menú, nada más.
alter table public.hogar add column ical_token text unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

alter publication supabase_realtime add table public.racion_congelada;
