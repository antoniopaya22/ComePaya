-- ComePayá · menú del bebé: comida y cena propias, recetas de bebé y alimentos ya introducidos.

-- Nombre del bebé con menú propio; null si no hay (el menú no muestra su fila).
alter table public.hogar add column bebe_nombre text check (char_length(bebe_nombre) between 1 and 40);

-- Cada franja es de la casa o del bebé: el mismo día y comida puede tener las dos.
alter table public.franja_menu add column para text not null default 'casa' check (para in ('casa', 'bebe'));
alter table public.franja_menu drop constraint franja_menu_hogar_id_fecha_tipo_key;
alter table public.franja_menu add constraint franja_menu_hogar_id_fecha_tipo_para_key unique (hogar_id, fecha, tipo, para);

-- Cuándo probó el bebé cada alimento por primera vez (null: aún no). Para avisar de lo nuevo.
alter table public.ingrediente add column bebe_introducido date;
