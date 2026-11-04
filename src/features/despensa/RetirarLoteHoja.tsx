import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, ListPlus, PackageOpen, Pencil, Trash2, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Contador, Opciones } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { abrirEnvase } from "@/dominio/alergenos";
import { describirCaducidad, hoyISO, type FechaISO } from "@/dominio/caducidad";
import { describirQueda, FRACCIONES_QUEDA, planMover, planQueda } from "@/dominio/despensa";
import { baseAEnvases, envasesABase, formatearCantidad, formatearLote } from "@/dominio/unidades";
import { UBICACIONES, type LoteConProducto, type Ubicacion } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useLotes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { useAnadirALista } from "../lista/useAnadirALista";
import type { CambiosDespensa } from "./cambios";
import { aplicarConDeshacer, avisarConDeshacer, deshacerDespensa } from "./deshacer";
import { SelectorCaducidad } from "./SelectorCaducidad";

/**
 * Cambiar cuánto hay de un lote, retirar todo o parte (consumido o tirado, §4.1), moverlo de sitio o corregir su caducidad.
 * Todo se puede deshacer desde el aviso que aparece después.
 */
export function RetirarLoteHoja({ lote, onCerrar }: { lote: LoteConProducto | null; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: lotes } = useLotes();
  const anadirTexto = useAnadirALista();
  const navigate = useNavigate();
  const [hay, setHay] = useState(1);
  const [envases, setEnvases] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [desaparecido, setDesaparecido] = useState(false);

  // Los datos se conservan mientras el panel se cierra animado.
  const [actual, setActual] = useState(lote);
  useEffect(() => {
    if (lote) {
      setActual(lote);
      const envase = envaseQueSeCuenta(lote);
      setHay(baseAEnvases(lote.cantidad, envase));
      // Lo habitual es coger uno o varios (sacar uno del congelador); lo que va a peso, todo.
      setEnvases(envase || lote.producto.ingrediente.unidad_base === "ud" ? Math.min(1, baseAEnvases(lote.cantidad, envase)) : baseAEnvases(lote.cantidad, envase));
      setDesaparecido(false);
    }
  }, [lote]);

  // Si otro móvil cambia o quita el lote con el panel abierto, se ve aquí (y no se guarda sobre datos viejos).
  useEffect(() => {
    if (!lote || !actual || !lotes) return;
    const vivo = lotes.find((l) => l.id === actual.id);
    if (!vivo) return setDesaparecido(true);
    if (vivo.cantidad === actual.cantidad && vivo.ubicacion === actual.ubicacion && vivo.fecha_caducidad === actual.fecha_caducidad && vivo.abierto_en === actual.abierto_en) return;
    const envase = envaseQueSeCuenta(vivo);
    setActual(vivo);
    setHay(baseAEnvases(vivo.cantidad, envase));
    setEnvases((e) => Math.min(e, baseAEnvases(vivo.cantidad, envase)));
    // Solo depende de los lotes: al abrir otro, el efecto de arriba ya lo pone al día.
  }, [lotes]);

  if (!actual) return null;
  const { producto } = actual;
  const unidad = producto.ingrediente.unidad_base;
  const envase = envaseQueSeCuenta(actual);
  const total = baseAEnvases(actual.cantidad, envase);
  const paso = envase || unidad === "ud" ? 1 : total > 10 ? 10 : 1;
  const sufijo = envase ? `× ${formatearCantidad(envase, unidad)}` : unidad;
  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });

  /** Apunta el ingrediente en la lista (si ya estaba pendiente, lo avisa en vez de duplicarlo). */
  function anadirALista() {
    const texto = anadirTexto(producto.ingrediente.nombre);
    if (!texto) return;
    toast.success(`${texto} añadido a la lista`, { action: { label: "Ver lista", onClick: () => navigate("/lista") } });
    onCerrar();
  }

  /** Aplica el cambio en una transacción y avisa con "Deshacer". Devuelve false si ha fallado. */
  async function hacer(cambios: CambiosDespensa, mensaje: string, descripcion?: string): Promise<boolean> {
    if (!actual) return false;
    setGuardando(true);
    try {
      const antes = await aplicarConDeshacer(hogar.id, cambios, lotes ?? [actual]);
      refrescar();
      avisarConDeshacer(queryClient, hogar.id, mensaje, () => deshacerDespensa(hogar.id, antes), { descripcion });
      return true;
    } catch (error) {
      toast.error(mensajeError(error));
      return false;
    } finally {
      setGuardando(false);
    }
  }

  /** Deja la cantidad en lo que hay de verdad (queda registrado como ajuste). Con 0, el lote se quita. */
  async function guardarCantidad() {
    if (!actual) return;
    const nueva = Math.max(0, Math.round(envasesABase(hay, envase) * 1000) / 1000);
    if (!Number.isFinite(nueva) || nueva === actual.cantidad) return;
    const movimientos = [{ producto_id: producto.id, cantidad: nueva - actual.cantidad, tipo: "ajuste" as const }];
    const ok = await hacer(
      nueva > 0 ? { lotes_actualizar: [{ id: actual.id, cantidad: nueva }], movimientos } : { lotes_borrar: [actual.id], movimientos },
      nueva > 0 ? `${producto.nombre}: ahora hay ${formatearLote(nueva, unidad, producto.cantidad_envase)}` : `${producto.nombre}: quitado de la despensa`,
    );
    if (ok) onCerrar();
  }

  async function retirar(tipo: "consumo" | "tirado") {
    if (!actual) return;
    const cantidad = Math.min(actual.cantidad, envasesABase(envases, envase));
    // Relativo: si otro miembro ha cambiado el lote mientras tanto, no se pisa.
    const ok = await hacer(
      { lotes_delta: [{ id: actual.id, delta: -cantidad }], movimientos: [{ producto_id: producto.id, cantidad: -cantidad, tipo }] },
      `${producto.nombre}: ${tipo === "consumo" ? "consumido" : "tirado"} ${formatearLote(cantidad, unidad, producto.cantidad_envase)}`,
    );
    if (ok) onCerrar();
  }

  async function cambiarCaducidad(fecha_caducidad: FechaISO | null) {
    if (!actual) return;
    const ok = await hacer({ lotes_actualizar: [{ id: actual.id, fecha_caducidad }] }, "Caducidad cambiada", describirCaducidad(fecha_caducidad, hoyISO()));
    if (ok) setActual({ ...actual, fecha_caducidad });
  }

  /** Producto abierto: se acorta la caducidad y, si había varios envases, el abierto se separa. */
  async function abrir() {
    if (!actual) return;
    const hoy = hoyISO();
    const { abierto, restoCerrado } = abrirEnvase(actual, producto.cantidad_envase, producto.ingrediente.dias_tras_abrir, hoy);
    // Lo que se abre y caduca rápido va a la nevera.
    const ubicacion: Ubicacion = producto.ingrediente.dias_tras_abrir && actual.ubicacion === "despensa" ? "nevera" : actual.ubicacion;
    const ok = await hacer(
      restoCerrado
        ? {
            // Relativo: el envase abierto sale del resto, aunque otro móvil haya cambiado cuántos quedan.
            lotes_delta: [{ id: restoCerrado.id, delta: restoCerrado.cantidad - actual.cantidad }],
            lotes_crear: [{ producto_id: producto.id, cantidad: abierto.cantidad, ubicacion, fecha_caducidad: abierto.fecha_caducidad, abierto_en: hoy }],
          }
        : { lotes_actualizar: [{ id: actual.id, ubicacion, fecha_caducidad: abierto.fecha_caducidad, abierto_en: hoy }] },
      "Marcado como abierto",
      abierto.fecha_caducidad ? `Ahora ${describirCaducidad(abierto.fecha_caducidad, hoy).toLowerCase()}${ubicacion !== actual.ubicacion ? " · a la nevera" : ""}.` : undefined,
    );
    if (ok) onCerrar();
  }

  /** "Está empezado y queda ½": abre un envase si hacía falta y deja lo que queda; lo gastado cuenta como consumido. */
  async function marcarQueda(fraccion: number) {
    if (!actual) return;
    const hoy = hoyISO();
    const { abierto, restoCerrado, consumido } = planQueda(actual, producto.cantidad_envase, fraccion, producto.ingrediente.dias_tras_abrir, hoy);
    const ubicacion: Ubicacion = !actual.abierto_en && producto.ingrediente.dias_tras_abrir && actual.ubicacion === "despensa" ? "nevera" : actual.ubicacion;
    const ok = await hacer(
      {
        ...(restoCerrado
          ? {
              lotes_delta: [{ id: restoCerrado.id, delta: restoCerrado.cantidad - actual.cantidad }],
              lotes_crear: [{ producto_id: producto.id, cantidad: abierto.cantidad, ubicacion, fecha_caducidad: abierto.fecha_caducidad, abierto_en: abierto.abierto_en }],
            }
          : {
              lotes_actualizar: [
                { id: actual.id, cantidad: abierto.cantidad, ubicacion, fecha_caducidad: abierto.fecha_caducidad, abierto_en: abierto.abierto_en },
              ],
            }),
        movimientos: consumido ? [{ producto_id: producto.id, cantidad: -consumido, tipo: consumido > 0 ? "consumo" : "ajuste" }] : undefined,
      },
      `Empezado · queda ${FRACCIONES_QUEDA.find((f) => f.valor === fraccion)?.etiqueta}`,
      abierto.fecha_caducidad ? describirCaducidad(abierto.fecha_caducidad, hoy) : undefined,
    );
    if (ok) onCerrar();
  }

  /** Mueve los envases elegidos en el contador: todos o solo una parte ("2 de los 6 a la nevera"). */
  async function mover(ubicacion: Ubicacion) {
    if (!actual || ubicacion === actual.ubicacion) return;
    const cantidad = Math.min(actual.cantidad, envasesABase(envases, envase));
    const plan = planMover(actual, cantidad, ubicacion, lotes ?? []);
    if (!plan) return;
    const destino = UBICACIONES.find((u) => u.valor === ubicacion)?.etiqueta.toLowerCase();
    const ok = await hacer(
      {
        lotes_actualizar: plan.cambiarUbicacion ? [{ id: plan.cambiarUbicacion.id, ubicacion }] : undefined,
        lotes_delta: plan.deltas.length ? plan.deltas : undefined,
        lotes_crear: plan.crear ? [{ ...plan.crear, ubicacion }] : undefined,
      },
      cantidad >= actual.cantidad ? `Movido a ${destino}` : `${formatearLote(cantidad, unidad, producto.cantidad_envase)} a ${destino}`,
    );
    if (ok) onCerrar();
  }

  // Lo de cada día: elegir cuántos y moverlos, gastarlos o tirarlos. Corregir la cantidad, lo empezado y la caducidad, en "Más opciones".
  return (
    <Hoja
      abierta={lote !== null}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo={producto.nombre}
      descripcion={`${formatearLote(actual.cantidad, unidad, producto.cantidad_envase)} · ${describirCaducidad(actual.fecha_caducidad, hoyISO())}`}
      pie={
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="peligro" tamano="lg" onClick={() => retirar("tirado")} disabled={guardando || desaparecido || envases <= 0}>
            <Trash2 /> Tirado
          </Boton>
          <Boton tamano="lg" onClick={() => retirar("consumo")} disabled={guardando || desaparecido || envases <= 0}>
            <Utensils /> Consumido
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {desaparecido && (
          <p role="alert" className="rounded-xl bg-aviso-suave px-3.5 py-3 text-sm font-medium text-aviso">
            Ya no está en la despensa: lo han cambiado desde otro móvil.
          </p>
        )}
        {total > 1 && (
          <Campo etiqueta="¿Cuántos?">
            <Contador etiqueta="(cuántos)" valor={envases} onChange={(v) => setEnvases(Math.min(v, total))} min={0} paso={paso} sufijo={`de ${total}${envase ? "" : ` ${unidad}`}`} />
          </Campo>
        )}
        <Campo etiqueta={total > 1 ? (envases < total ? `Mover ${envases} de ${total} a` : "Mover todos a") : "Mover a"}>
          <Opciones opciones={UBICACIONES} valor={actual.ubicacion} onChange={mover} className="[&_button]:h-11 [&_button]:flex-1 [&_button]:text-[15px]" />
        </Campo>
        <button type="button" onClick={anadirALista} className="inline-flex h-11 items-center gap-1.5 self-start text-[15px] font-medium text-primario">
          <ListPlus className="size-4" /> Añadir a la lista
        </button>

        <details className="group rounded-xl border border-borde">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-3.5 text-[15px] font-medium">
            Más opciones <ChevronDown className="size-4 text-suave transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-5 border-t border-borde px-3.5 pt-3 pb-4">
            <Campo
              etiqueta="Corregir cuántos hay"
              ayuda={hay !== total ? "Guarda para que se vea igual en todos los móviles de casa." : "Si no cuadra con lo que hay de verdad. No cuenta como gastado ni tirado."}
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <Contador etiqueta="(cuántos hay)" valor={hay} onChange={(v) => setHay(Math.max(0, v))} min={0} paso={paso} sufijo={sufijo} />
                </div>
                {hay !== total && (
                  <Boton tamano="lg" onClick={guardarCantidad} disabled={guardando || desaparecido}>
                    <Check /> Guardar
                  </Boton>
                )}
              </div>
            </Campo>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-suave">
                {actual.abierto_en
                  ? `Empezado el ${new Date(actual.abierto_en + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}${
                      describirQueda(actual.cantidad, producto.cantidad_envase) ? ` · ${describirQueda(actual.cantidad, producto.cantidad_envase)}` : ""
                    }. ¿Cuánto queda ahora?`
                  : "¿Está empezado? ¿Cuánto queda?"}
              </p>
              <div className="flex gap-2">
                {FRACCIONES_QUEDA.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    onClick={() => marcarQueda(f.valor)}
                    aria-label={`Queda ${f.etiqueta}`}
                    className="h-11 flex-1 rounded-xl border border-borde bg-superficie text-lg font-semibold transition-colors active:scale-95 active:bg-superficie-2"
                  >
                    {f.etiqueta}
                  </button>
                ))}
              </div>
              {!actual.abierto_en && (
                <Boton variante="secundario" onClick={abrir} className="self-start">
                  <PackageOpen /> Lo he abierto
                  {producto.ingrediente.dias_tras_abrir ? <span className="font-normal text-suave">· dura {producto.ingrediente.dias_tras_abrir} días</span> : null}
                </Boton>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-suave">Caducidad</p>
              <SelectorCaducidad valor={actual.fecha_caducidad} onChange={cambiarCaducidad} hoy={hoyISO()} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <Link to={`/productos/${producto.id}?editar=1`} onClick={onCerrar} className="inline-flex h-11 items-center gap-1.5 text-[15px] font-medium text-primario">
                <Pencil className="size-4" /> Cambiar nombre o datos
              </Link>
              <Link to={`/productos/${producto.id}`} onClick={onCerrar} className="inline-flex h-11 items-center gap-1 text-[15px] font-medium text-primario">
                Ver ficha <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        </details>
      </div>
    </Hoja>
  );
}

/** Con envase se cuentan envases ("2 × 1 l"); lo que va por unidades (huevos, yogures) se cuenta por unidades. */
function envaseQueSeCuenta(lote: LoteConProducto): number | null {
  return lote.producto.ingrediente.unidad_base === "ud" ? null : lote.producto.cantidad_envase;
}
