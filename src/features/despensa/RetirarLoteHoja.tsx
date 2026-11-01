import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Trash2, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Contador, Entrada, Opciones } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { describirCaducidad, hoyISO, type FechaISO } from "@/dominio/caducidad";
import { baseAEnvases, envasesABase, formatearLote } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import { UBICACIONES, type LoteConProducto, type Ubicacion } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { SelectorCaducidad } from "./SelectorCaducidad";

/** Retirar todo o parte de un lote (consumido o tirado, §4.1), moverlo de sitio o corregir su caducidad y cantidad. */
export function RetirarLoteHoja({ lote, onCerrar }: { lote: LoteConProducto | null; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const [envases, setEnvases] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [cantidadReal, setCantidadReal] = useState("");

  // Los datos se conservan mientras el panel se cierra animado.
  const [actual, setActual] = useState(lote);
  useEffect(() => {
    if (lote) {
      setActual(lote);
      setEnvases(baseAEnvases(lote.cantidad, lote.producto.cantidad_envase));
      setCantidadReal(String(lote.cantidad).replace(".", ","));
    }
  }, [lote]);

  if (!actual) return null;
  const { producto } = actual;
  const total = baseAEnvases(actual.cantidad, producto.cantidad_envase);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });

  async function retirar(tipo: "consumo" | "tirado") {
    if (!actual) return;
    setGuardando(true);
    try {
      const cantidad = Math.min(actual.cantidad, envasesABase(envases, producto.cantidad_envase));
      const restante = actual.cantidad - cantidad;
      const { error } =
        restante > 0
          ? await supabase.from("lote_despensa").update({ cantidad: restante }).eq("id", actual.id)
          : await supabase.from("lote_despensa").delete().eq("id", actual.id);
      if (error) throw error;
      await supabase.from("movimiento_despensa").insert({ hogar_id: hogar.id, producto_id: producto.id, cantidad: -cantidad, tipo });
      refrescar();
      toast.success(tipo === "consumo" ? "Marcado como consumido" : "Marcado como tirado");
      onCerrar();
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarCaducidad(fecha_caducidad: FechaISO | null) {
    if (!actual) return;
    setActual({ ...actual, fecha_caducidad });
    const { error } = await supabase.from("lote_despensa").update({ fecha_caducidad }).eq("id", actual.id);
    if (error) return toast.error(mensajeError(error));
    refrescar();
  }

  /** Corrige la cantidad a lo que realmente hay (queda registrado como ajuste). */
  async function ajustar() {
    if (!actual) return;
    const nueva = Number(cantidadReal.replace(",", "."));
    if (!(nueva > 0) || nueva === actual.cantidad) return;
    const { error } = await supabase.from("lote_despensa").update({ cantidad: nueva }).eq("id", actual.id);
    if (error) return toast.error(mensajeError(error));
    await supabase.from("movimiento_despensa").insert({ hogar_id: hogar.id, producto_id: producto.id, cantidad: nueva - actual.cantidad, tipo: "ajuste" });
    setActual({ ...actual, cantidad: nueva });
    refrescar();
    toast.success("Cantidad corregida");
  }

  async function mover(ubicacion: Ubicacion) {
    if (!actual || ubicacion === actual.ubicacion) return;
    setActual({ ...actual, ubicacion });
    const { error } = await supabase.from("lote_despensa").update({ ubicacion }).eq("id", actual.id);
    if (error) return toast.error(mensajeError(error));
    refrescar();
  }

  return (
    <Hoja
      abierta={lote !== null}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo={producto.nombre}
      descripcion={`${formatearLote(actual.cantidad, producto.ingrediente.unidad_base, producto.cantidad_envase)} · ${describirCaducidad(actual.fecha_caducidad, hoyISO())}`}
      pie={
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="peligro" tamano="lg" onClick={() => retirar("tirado")} disabled={guardando || envases <= 0}>
            <Trash2 /> Tirado
          </Boton>
          <Boton tamano="lg" onClick={() => retirar("consumo")} disabled={guardando || envases <= 0}>
            <Utensils /> Consumido
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Campo etiqueta={`Cuánto retiras (hay ${formatearLote(actual.cantidad, producto.ingrediente.unidad_base, producto.cantidad_envase)})`}>
          <Contador valor={envases} onChange={(v) => setEnvases(Math.min(v, total))} min={0} paso={producto.cantidad_envase ? 1 : total > 10 ? 10 : 1} />
        </Campo>
        <Campo etiqueta="Mover a">
          <Opciones opciones={UBICACIONES} valor={actual.ubicacion} onChange={mover} />
        </Campo>
        <details className="rounded-xl border border-borde px-3.5 py-3">
          <summary className="cursor-pointer text-sm font-medium">Corregir caducidad o cantidad</summary>
          <div className="mt-3 flex flex-col gap-4">
            <SelectorCaducidad valor={actual.fecha_caducidad} onChange={cambiarCaducidad} hoy={hoyISO()} />
            <div className="flex items-end gap-2">
              <Campo etiqueta={`Cantidad real (${producto.ingrediente.unidad_base})`} className="flex-1">
                <Entrada inputMode="decimal" value={cantidadReal} onChange={(e) => setCantidadReal(e.target.value)} />
              </Campo>
              <Boton variante="secundario" onClick={ajustar} disabled={!(Number(cantidadReal.replace(",", ".")) > 0)}>
                Ajustar
              </Boton>
            </div>
          </div>
        </details>
        <Link to={`/productos/${producto.id}`} onClick={onCerrar} className="inline-flex items-center gap-1 self-start text-sm font-medium text-primario">
          Ver ficha del producto <ChevronRight className="size-4" />
        </Link>
      </div>
    </Hoja>
  );
}
