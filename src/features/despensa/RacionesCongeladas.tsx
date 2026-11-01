import { useQueryClient } from "@tanstack/react-query";
import { Plus, Snowflake, Trash2, Utensils } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Contador, Entrada } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { Tarjeta } from "@/components/ui/varios";
import { diasHasta, hoyISO } from "@/dominio/caducidad";
import { supabase } from "@/lib/supabase";
import { useTiempoReal } from "@/lib/tiempo-real";
import type { RacionCongelada } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useRacionesCongeladas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";

/** Raciones de comida ya cocinada en el congelador (§4.1). */
export function RacionesCongeladas() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: raciones = [] } = useRacionesCongeladas();
  useTiempoReal("racion_congelada", hogar.id, claves.raciones(hogar.id));
  const [nueva, setNueva] = useState(false);
  const hoy = hoyISO();
  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.raciones(hogar.id) });

  async function gastar(r: RacionCongelada, tirar: boolean) {
    const { error } =
      r.raciones > 1 && !tirar
        ? await supabase.from("racion_congelada").update({ raciones: r.raciones - 1 }).eq("id", r.id)
        : await supabase.from("racion_congelada").delete().eq("id", r.id);
    if (error) return toast.error(mensajeError(error));
    refrescar();
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-suave uppercase">
          <Snowflake className="size-3.5" /> Raciones congeladas
        </h2>
        <Boton variante="fantasma" tamano="sm" className="h-8" onClick={() => setNueva(true)}>
          <Plus /> Añadir
        </Boton>
      </div>
      {raciones.length === 0 ? (
        <p className="px-1 text-sm text-suave">Ninguna. Al marcar un plato como cocinado puedes congelar lo que sobre.</p>
      ) : (
        <Tarjeta className="divide-y divide-borde">
          {raciones.map((r) => {
            const dias = diasHasta(hoy, r.fecha_congelacion);
            return (
              <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.descripcion}</p>
                  <p className="text-xs text-suave">
                    {r.raciones} {r.raciones === 1 ? "ración" : "raciones"} · congelada hace {dias === 0 ? "nada" : `${dias} días`}
                  </p>
                </div>
                <Boton variante="secundario" tamano="sm" onClick={() => gastar(r, false)}>
                  <Utensils /> Usar 1
                </Boton>
                <Boton variante="fantasma" tamano="icono-sm" aria-label={`Tirar ${r.descripcion}`} onClick={() => gastar(r, true)}>
                  <Trash2 />
                </Boton>
              </div>
            );
          })}
        </Tarjeta>
      )}
      <NuevaRacionHoja abierta={nueva} onCerrar={() => setNueva(false)} />
    </section>
  );
}

function NuevaRacionHoja({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const [descripcion, setDescripcion] = useState("");
  const [raciones, setRaciones] = useState(2);

  async function guardar() {
    const { error } = await supabase.from("racion_congelada").insert({ hogar_id: hogar.id, descripcion: descripcion.trim(), raciones });
    if (error) return toast.error(mensajeError(error));
    queryClient.invalidateQueries({ queryKey: claves.raciones(hogar.id) });
    setDescripcion("");
    onCerrar();
  }

  return (
    <Hoja
      abierta={abierta}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo="Ración congelada"
      pie={
        <Boton className="w-full" onClick={guardar} disabled={!descripcion.trim()}>
          Guardar
        </Boton>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Qué es">
          <Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Albóndigas en salsa" />
        </Campo>
        <Campo etiqueta="Raciones">
          <Contador valor={raciones} onChange={(v) => setRaciones(Math.max(1, Math.round(v)))} min={1} />
        </Campo>
      </div>
    </Hoja>
  );
}
