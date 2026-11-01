-- Despensa · permisos explícitos para las funciones de servidor (clave secreta = rol service_role).
-- Necesario si el proyecto se creó sin "Automatically expose new tables": entonces ningún rol
-- recibe permisos por defecto sobre las tablas nuevas. service_role salta RLS, pero necesita los GRANT.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Y por si alguna tabla de las migraciones anteriores quedó sin permiso para los usuarios con sesión.
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.aviso_enviado from authenticated;
