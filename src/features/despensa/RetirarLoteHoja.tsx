import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, PackageOpen, Trash2, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Contador, Entrada, Opciones } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { abrirEnvase } from "@/dominio/alergenos";
import { describirCaducidad, hoyISO, type FechaISO } from "@/dominio/caducidad";
import { baseAEnvases, envasesABase, formatearLote } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import { UBICACIONES, type LoteConProducto, type Ubicacion } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { aplicarCambiosDespensa } from "./cambios";
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
      // Relativo: si otro miembro ha cambiado el lote mientras tanto, no se pisa.
      await aplicarCambiosDespensa(hogar.id, {
        lotes_delta: [{ id: actual.id, delta: -cantidad }],
        movimientos: [{ producto_id: producto.id, cantidad: -cantidad, tipo }],
      });
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
    try {
      await aplicarCambiosDespensa(hogar.id, {
        lotes_actualizar: [{ id: actual.id, cantidad: nueva }],
        movimientos: [{ producto_id: producto.id, cantidad: nueva - actual.cantidad, tipo: "ajuste" }],
      });
    } catch (error) {
      return toast.error(mensajeError(error));
    }
    setActual({ ...actual, cantidad: nueva });
    refrescar();
    toast.success("Cantidad corregida");
  }

  /** Producto abierto: se acorta la caducidad y, si había varios envases, el abierto se separa. */
  async function abrir() {
    if (!actual) return;
    const hoy = hoyISO();
    const { abierto, restoCerrado } = abrirEnvase(actual, producto.cantidad_envase, producto.ingrediente.dias_tras_abrir, hoy);
    // Lo que se abre y caduca rápido va a la nevera.
    const ubicacion: Ubicacion = producto.ingrediente.dias_tras_abrir && actual.ubicacion === "despensa" ? "nevera" : actual.ubicacion;
    try {
      await aplicarCambiosDespensa(
        hogar.id,
        restoCerrado
          ? {
              lotes_actualizar: [{ id: restoCerrado.id, cantidad: restoCerrado.cantidad }],
              lotes_crear: [{ producto_id: producto.id, cantidad: abierto.cantidad, ubicacion, fecha_caducidad: abierto.fecha_caducidad, abierto_en: hoy }],
            }
          : { lotes_actualizar: [{ id: actual.id, ubicacion, fecha_caducidad: abierto.fecha_caducidad, abierto_en: hoy }] },
      );
    } catch (error) {
      return toast.error(mensajeError(error));
    }
    refrescar();
    toast.success("Marcado como abierto", {
      description: abierto.fecha_caducidad ? `Ahora ${describirCaducidad(abierto.fecha_caducidad, hoy).toLowerCase()}${ubicacion !== actual.ubicacion ? " · a la nevera" : ""}.` : undefined,
    });
    onCerrar();
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
        {actual.abierto_en ? (
          <p className="rounded-xl bg-superficie-2 px-3 py-2 text-sm text-suave">Abierto el {new Date(actual.abierto_en + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</p>
        ) : (
          <Boton variante="secundario" onClick={abrir} className="self-start">
            <PackageOpen /> Lo he abierto
            {producto.ingrediente.dias_tras_abrir ? <span className="font-normal text-suave">· dura {producto.ingrediente.dias_tras_abrir} días</span> : null}
          </Boton>
        )}
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
