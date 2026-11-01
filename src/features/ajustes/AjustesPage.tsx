import { useQueryClient } from "@tanstack/react-query";
import { Bug, CalendarPlus, Carrot, ChartColumn, ChevronRight, Copy, HeartPulse, LogOut, Plus, RefreshCw, Share2, Store, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Contador, Interruptor, Selector } from "@/components/ui/campos";
import { Cabecera, Etiqueta, Tarjeta } from "@/components/ui/varios";
import { urlReportarProblema, VERSION } from "@/lib/errores";
import { supabase } from "@/lib/supabase";
import type { Tienda } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { cerrarSesion, useUsuario } from "../sesion/SesionProvider";
import { claves, useMiembros, useTiendas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { SaludHoja } from "../salud/SaludHoja";
import { activarAvisos, avisosDisponibles, desactivarAvisos, suscripcionActual } from "./avisos";
import { TiendaHoja } from "./TiendaHoja";

export function AjustesPage() {
  const usuario = useUsuario();
  const { hogar, rol, hogares, cambiarHogar, anadirHogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: miembros = [] } = useMiembros();
  const { data: tiendas = [] } = useTiendas();
  const [tienda, setTienda] = useState<Tienda | "nueva" | null>(null);
  const [salud, setSalud] = useState(false);

  async function compartirCodigo() {
    const texto = `Únete a «${hogar.nombre}» en ComePayá con el código ${hogar.codigo_invitacion}: ${window.location.origin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ComePayá", text: texto });
      } catch {
        // El usuario ha cerrado el diálogo de compartir.
      }
    } else {
      await navigator.clipboard.writeText(hogar.codigo_invitacion);
      toast.success("Código copiado");
    }
  }

  async function cambiarComensales(comensales: number) {
    const { error } = await supabase.from("hogar").update({ comensales }).eq("id", hogar.id);
    if (error) return toast.error(mensajeError(error));
    queryClient.invalidateQueries({ queryKey: ["hogares", usuario.id] });
  }

  async function regenerarCodigo() {
    const { error } = await supabase.rpc("regenerar_codigo_invitacion", { p_hogar_id: hogar.id });
    if (error) return toast.error(mensajeError(error));
    await queryClient.invalidateQueries({ queryKey: ["hogares", usuario.id] });
    toast.success("Código nuevo generado. El anterior ya no sirve.");
  }

  return (
    <>
      <Cabecera titulo="Ajustes" subtitulo={usuario.email} />

      <div className="flex flex-col gap-6 px-4 md:px-0">
        <Bloque titulo="Hogar">
          <Tarjeta className="flex flex-col gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{hogar.nombre}</p>
                <p className="text-sm text-suave">Todo lo que hay en la app es compartido entre sus miembros.</p>
              </div>
              {hogares.length > 1 && (
                <Selector aria-label="Cambiar de hogar" className="h-9 w-auto text-sm" value={hogar.id} onChange={(e) => cambiarHogar(e.target.value)}>
                  {hogares.map((h) => (
                    <option key={h.hogar.id} value={h.hogar.id}>
                      {h.hogar.nombre}
                    </option>
                  ))}
                </Selector>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-medium">Comensales</p>
                <p className="text-xs text-suave">Raciones por defecto de cada comida y cena del menú.</p>
              </div>
              {rol === "admin" ? (
                <div className="w-36 shrink-0">
                  <Contador valor={hogar.comensales ?? 2} onChange={(v) => cambiarComensales(Math.min(20, Math.max(1, Math.round(v))))} min={1} />
                </div>
              ) : (
                <span className="text-lg font-semibold">{hogar.comensales ?? 2}</span>
              )}
            </div>

            <div className="rounded-xl bg-superficie-2 p-3">
              <p className="text-xs font-medium text-suave">Código de invitación</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-semibold tracking-[0.25em]">{hogar.codigo_invitacion}</span>
                <div className="flex gap-1">
                  <Boton
                    variante="fantasma"
                    tamano="icono-sm"
                    aria-label="Copiar código"
                    onClick={async () => {
                      await navigator.clipboard.writeText(hogar.codigo_invitacion);
                      toast.success("Código copiado");
                    }}
                  >
                    <Copy />
                  </Boton>
                  <Boton variante="fantasma" tamano="icono-sm" aria-label="Compartir invitación" onClick={compartirCodigo}>
                    <Share2 />
                  </Boton>
                  {rol === "admin" && (
                    <Boton variante="fantasma" tamano="icono-sm" aria-label="Generar un código nuevo" onClick={regenerarCodigo}>
                      <RefreshCw />
                    </Boton>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-suave">Quien lo introduzca al entrar se unirá a este hogar.</p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-suave">
                <Users className="size-4" /> Miembros
              </p>
              <ul className="flex flex-col gap-2">
                {miembros.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-primario-suave text-sm font-semibold text-primario">
                      {(m.nombre ?? m.email ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {m.nombre ?? m.email}
                        {m.user_id === usuario.id && " (tú)"}
                      </span>
                      <span className="block truncate text-xs text-suave">{m.email}</span>
                    </span>
                    {m.rol === "admin" && <Etiqueta>Admin</Etiqueta>}
                  </li>
                ))}
              </ul>
            </div>
          </Tarjeta>
          <Boton variante="fantasma" className="self-start" onClick={anadirHogar}>
            <Plus /> Crear o unirme a otro hogar
          </Boton>
        </Bloque>

        <Bloque titulo="Compra">
          <Tarjeta className="divide-y divide-borde">
            {tiendas.map((t) => (
              <Fila key={t.id} icono={<Store />} titulo={t.nombre} detalle={`${t.orden_secciones.length} secciones en orden de recorrido`} onClick={() => setTienda(t)} />
            ))}
            <Fila icono={<Plus />} titulo="Añadir tienda" onClick={() => setTienda("nueva")} />
          </Tarjeta>
        </Bloque>

        <Bloque titulo="Cocina y salud">
          <Tarjeta className="divide-y divide-borde">
            <Link to="/ajustes/ingredientes" className="block">
              <Fila icono={<Carrot />} titulo="Ingredientes" detalle="Unidades, secciones, grupos, nutrientes y caducidad" />
            </Link>
            <Fila icono={<HeartPulse />} titulo="Equilibrio y aditivos" detalle="Reglas semanales por grupo de alimentos" onClick={() => setSalud(true)} />
            <Link to="/ajustes/estadisticas" className="block">
              <Fila icono={<ChartColumn />} titulo="Estadísticas" detalle="Desperdicio, platos más cocinados y equilibrio" />
            </Link>
            {hogar.ical_token && (
              <Fila
                icono={<CalendarPlus />}
                titulo="Menú en tu calendario"
                detalle="Copia la URL y añádela en Google Calendar → Otros calendarios → Desde URL"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}/api/ical?token=${hogar.ical_token}`);
                  toast.success("URL del calendario copiada", { description: "Es privada: quien la tenga verá vuestro menú." });
                }}
              />
            )}
          </Tarjeta>
        </Bloque>

        <Bloque titulo="Ayuda">
          <Tarjeta>
            <a href={urlReportarProblema()} target="_blank" rel="noreferrer" className="block">
              <Fila icono={<Bug />} titulo="Reportar un problema o una idea" detalle={`Abre un aviso en GitHub con los datos del móvil · versión ${VERSION}`} />
            </a>
          </Tarjeta>
        </Bloque>

        <Bloque titulo="Avisos en este dispositivo">
          <InterruptorAvisos />
        </Bloque>

        <Boton variante="contorno" onClick={() => cerrarSesion()} className="mb-4">
          <LogOut /> Cerrar sesión
        </Boton>
      </div>

      <SaludHoja abierta={salud} onCerrar={() => setSalud(false)} />
      <TiendaHoja
        tienda={tienda}
        onCerrar={() => {
          setTienda(null);
          queryClient.invalidateQueries({ queryKey: claves.tiendas(hogar.id) });
        }}
      />
    </>
  );
}

function InterruptorAvisos() {
  const { hogar } = useHogar();
  const [activos, setActivos] = useState<boolean | null>(null);

  useEffect(() => {
    suscripcionActual()
      .then((s) => setActivos(Boolean(s)))
      .catch(() => setActivos(false));
  }, []);

  if (!avisosDisponibles) {
    return <p className="px-1 text-sm text-suave">Este navegador no admite notificaciones, o la app aún no tiene configuradas las claves de avisos.</p>;
  }

  return (
    <Interruptor
      marcado={Boolean(activos)}
      etiqueta="Recordatorios"
      ayuda="Preparación previa del menú (remojos, descongelar) y lo que caduca en los próximos días."
      onChange={async (v) => {
        try {
          if (v) await activarAvisos(hogar.id);
          else await desactivarAvisos();
          setActivos(v);
          if (v) toast.success("Avisos activados en este dispositivo");
        } catch (error) {
          toast.error(mensajeError(error));
        }
      }}
    />
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-suave uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

function Fila({ icono, titulo, detalle, onClick }: { icono: ReactNode; titulo: string; detalle?: string; onClick?: () => void }) {
  const contenido = (
    <>
      <span className="grid size-9 place-items-center rounded-xl bg-superficie-2 text-suave [&_svg]:size-[18px]">{icono}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-medium">{titulo}</span>
        {detalle && <span className="block truncate text-sm text-suave">{detalle}</span>}
      </span>
      <ChevronRight className="size-4 text-suave" />
    </>
  );
  const clases = "flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-superficie-2";
  return onClick ? (
    <button onClick={onClick} className={clases}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}
