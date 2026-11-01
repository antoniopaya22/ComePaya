-- Despensa · iconos de ingredientes, fotos de recetas y almacenamiento de imágenes.

alter table public.ingrediente add column emoji text check (char_length(emoji) <= 16);
alter table public.receta add column foto_url text;
alter table public.receta add column fuente_url text;

-- Bucket público de lectura para fotos (las URLs llevan un nombre aleatorio).
-- Cada hogar escribe solo en su carpeta: fotos/<hogar_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Los miembros suben fotos a su hogar" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
create policy "Los miembros cambian fotos de su hogar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
create policy "Los miembros borran fotos de su hogar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));

-- Recetas e ingredientes también en tiempo real: si otro miembro edita, se ve sin recargar.
alter publication supabase_realtime add table public.receta, public.ingrediente;
