import { BarChart3, Bell, Bug, LogOut, RefreshCw, Settings, Sparkles } from "lucide-react";
import { useMemo, useState, type ComponentProps } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Menu, MenuContenido, MenuDisparador, MenuEtiqueta, MenuOpcion, MenuSeparador } from "@/components/ui/menu";
import { describirCaducidad, estadoCaducidad, hoyISO } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { useLotes } from "@/features/datos";
import { useHogar } from "@/features/hogar/HogarProvider";
import { iniciarRecorrido } from "@/features/recorrido/Recorrido";
import { cerrarSesion, useUsuario } from "@/features/sesion/SesionProvider";
import { recargar } from "@/lib/actualizacion";
import { urlReportarProblema } from "@/lib/errores";
import type { LoteConProducto } from "@/lib/tipos";
import { cn } from "@/lib/utils";

// Piezas de la cuenta y los avisos que comparten la barra superior de escritorio y la barra de Hoy en el móvil.

/** Lo que está caducado o caduca en los próximos días, lo más urgente primero. */
export function useUrgentes(): LoteConProducto[] {
  const { data: lotes } = useLotes();
  return useMemo(() => {
    const hoy = hoyISO();
    return (lotes ?? []).filter((l) => ["caducado", "pronto"].includes(estadoCaducidad(l.fecha_caducidad, hoy)));
  }, [lotes]);
}

export function BotonIcono({ etiqueta, className, ...props }: ComponentProps<"button"> & { etiqueta: string }) {
  return (
    <button
      aria-label={etiqueta}
      title={etiqueta}
      className={cn("relative grid size-11 place-items-center rounded-full text-texto/80 transition-colors hover:bg-superficie-2 hover:text-texto active:bg-superficie-2 md:size-10 md:rounded-xl md:text-suave [&_svg]:size-[22px] md:[&_svg]:size-5", className)}
      {...props}
    />
  );
}

/** Campana con lo que caduca: un vistazo rápido sin ir a la despensa. */
export function Avisos() {
  const urgentes = useUrgentes();
  const navigate = useNavigate();
  const hoy = hoyISO();
  return (
    <Menu>
      <MenuDisparador asChild>
        <BotonIcono etiqueta={urgentes.length ? `${urgentes.length} avisos de caducidad` : "Avisos"} data-recorrido="avisos">
          <Bell />
          {urgentes.length > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-aviso px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-fondo">
              {urgentes.length > 9 ? "9+" : urgentes.length}
            </span>
          )}
        </BotonIcono>
      </MenuDisparador>
      <MenuContenido className="w-80">
        <MenuEtiqueta>Caducidades</MenuEtiqueta>
        {urgentes.length === 0 && <p className="px-3 pt-1 pb-3 text-sm text-suave">Nada caduca en los próximos días. 👌</p>}
        {urgentes.slice(0, 6).map((l) => {
          const p = l.producto;
          const caducado = estadoCaducidad(l.fecha_caducidad, hoy) === "caducado";
          return (
            <MenuOpcion key={l.id} onSelect={() => navigate(`/productos/${p.id}`)} className="py-1.5">
              <span className="text-lg">{emojiPara(p.ingrediente?.nombre ?? p.nombre, p.ingrediente?.seccion_super ?? null, p.ingrediente?.emoji)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.nombre}</span>
                <span className={cn("block text-xs first-letter:uppercase", caducado ? "text-peligro" : "text-aviso")}>
                  {describirCaducidad(l.fecha_caducidad, hoy)}
                </span>
              </span>
            </MenuOpcion>
          );
        })}
        {urgentes.length > 0 && (
          <>
            <MenuSeparador />
            <MenuOpcion onSelect={() => navigate("/despensa")} className="justify-center font-medium text-primario">
              Ver la despensa{urgentes.length > 6 ? ` (${urgentes.length - 6} más)` : ""}
            </MenuOpcion>
          </>
        )}
      </MenuContenido>
    </Menu>
  );
}

export function MenuUsuario() {
  const usuario = useUsuario();
  const { hogar } = useHogar();
  const navigate = useNavigate();
  const nombre: string = usuario.user_metadata.full_name ?? usuario.user_metadata.name ?? usuario.email ?? "";
  return (
    <Menu>
      <MenuDisparador data-recorrido="hogar" className="mr-1.5 ml-1 rounded-full md:mr-0 ring-offset-2 ring-offset-fondo outline-none focus-visible:ring-2 focus-visible:ring-primario" aria-label="Tu cuenta">
        <Avatar url={usuario.user_metadata.avatar_url} nombre={nombre} />
      </MenuDisparador>
      <MenuContenido className="w-64">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar url={usuario.user_metadata.avatar_url} nombre={nombre} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{nombre}</p>
            <p className="truncate text-xs text-suave">{usuario.email}</p>
          </div>
        </div>
        <p className="mx-3 mb-1 truncate rounded-lg bg-superficie-2 px-2 py-1 text-xs text-suave md:hidden">🏠 {hogar.nombre}</p>
        <MenuSeparador />
        <MenuOpcion onSelect={() => navigate("/ajustes")}>
          <Settings /> Ajustes y hogar
        </MenuOpcion>
        <MenuOpcion onSelect={() => navigate("/ajustes/estadisticas")}>
          <BarChart3 /> Estadísticas
        </MenuOpcion>
        <MenuOpcion onSelect={() => toast.promise(recargar(), { loading: "Actualizando…", success: "Todo al día", error: "No se ha podido actualizar" })}>
          <RefreshCw /> Actualizar
        </MenuOpcion>
        <MenuOpcion onSelect={iniciarRecorrido}>
          <Sparkles /> Ver el recorrido
        </MenuOpcion>
        <MenuOpcion onSelect={() => window.open(urlReportarProblema(), "_blank", "noopener")}>
          <Bug /> Reportar un problema
        </MenuOpcion>
        <MenuSeparador />
        <MenuOpcion peligro onSelect={() => cerrarSesion()}>
          <LogOut /> Cerrar sesión
        </MenuOpcion>
      </MenuContenido>
    </Menu>
  );
}

export function Avatar({ url, nombre }: { url?: string; nombre: string }) {
  const [fallo, setFallo] = useState(false);
  if (url && !fallo) {
    return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFallo(true)} className="size-9 shrink-0 rounded-full border border-borde object-cover" />;
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primario text-sm font-semibold text-primario-texto">{iniciales(nombre) || "?"}</span>
  );
}

export function iniciales(nombre: string): string {
  return nombre
    .replace(/^(casa|hogar) de /i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
