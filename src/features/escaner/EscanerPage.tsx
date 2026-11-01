import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Flashlight, FlashlightOff, LoaderCircle, ScanBarcode, Undo2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Opciones } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { Cabecera, Etiqueta, Tarjeta } from "@/components/ui/varios";
import { preguntarCaducidad } from "@/dominio/escaneo";
import type { ProductoExterno } from "@/dominio/producto-externo";
import { envasesABase } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import { UBICACIONES, type Ubicacion } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, useProductos } from "../datos";
import { anadirLote } from "../despensa/altas";
import { useHogar } from "../hogar/HogarProvider";
import { PanelEscaneo, type Escaneado, type Guardado } from "./PanelEscaneo";
import { useCamara } from "./useCamara";

/**
 * Escaneo continuo (§7.1): se elige la ubicación, se pasan productos uno tras otro y cada uno va a la despensa.
 * Los conocidos sin caducidad en la despensa se añaden solos; el resto abre el panel inferior sin parar la cámara.
 */
export function EscanerPage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: productos = [] } = useProductos();
  const [ubicacion, setUbicacion] = useState<Ubicacion>("nevera");
  const [pendientes, setPendientes] = useState<Escaneado[]>([]);
  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [repeticiones, setRepeticiones] = useState(0);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });
    queryClient.invalidateQueries({ queryKey: claves.productos(hogar.id) });
    queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
  };

  async function sumarUno(guardado: Guardado) {
    const { data } = await supabase.from("lote_despensa").select("cantidad").eq("id", guardado.loteId).single();
    const nueva = (data?.cantidad ?? 0) + envasesABase(1, guardado.producto.cantidad_envase);
    const { error } = await supabase.from("lote_despensa").update({ cantidad: nueva }).eq("id", guardado.loteId);
    if (error) return toast.error(mensajeError(error));
    setGuardados((lista) => lista.map((g) => (g.loteId === guardado.loteId ? { ...g, envases: g.envases + 1 } : g)));
    refrescar();
    toast.success(`+1 ${guardado.producto.nombre}`);
  }

  async function anadirDirecto(ean: string, producto: Guardado["producto"]) {
    try {
      const loteId = await anadirLote(hogar.id, producto, envasesABase(1, producto.cantidad_envase), ubicacion, null, "Escaneo");
      alGuardar({ ean, loteId, producto, envases: 1 }, true);
    } catch (error) {
      toast.error(mensajeError(error));
    }
  }

  async function alDetectar(ean: string) {
    // Escanear dos veces el mismo producto suma una unidad (§7.1).
    const yaGuardado = guardados.find((g) => g.ean === ean);
    if (yaGuardado && abierto !== ean) return sumarUno(yaGuardado);
    if (abierto === ean) return setRepeticiones((n) => n + 1);
    if (pendientes.some((p) => p.ean === ean)) return abrir(ean);

    const propio = productos.find((p) => p.ean === ean);
    if (propio) {
      const dias = propio.caducidad_habitual_dias ?? propio.ingrediente.caducidad_defecto_dias;
      if (!preguntarCaducidad(ubicacion, dias)) return anadirDirecto(ean, propio);
      setPendientes((lista) => [{ ean, estado: "propio", producto: propio }, ...lista]);
      return abrir(ean);
    }

    setPendientes((lista) => [{ ean, estado: "buscando" }, ...lista]);
    abrir(ean);
    const resultado = await consultar(ean);
    setPendientes((lista) => lista.map((p) => (p.ean === ean ? resultado : p)));
  }

  function abrir(ean: string) {
    setRepeticiones(0);
    setAbierto(ean);
  }

  function alGuardar(guardado: Guardado, directo = false) {
    setPendientes((lista) => lista.filter((p) => p.ean !== guardado.ean));
    setGuardados((lista) => [guardado, ...lista.filter((g) => g.ean !== guardado.ean)]);
    if (!directo) setAbierto(null);
    refrescar();
    toast.success(`${guardado.producto.nombre} añadido`, { action: { label: "Deshacer", onClick: () => deshacer(guardado) } });
  }

  async function deshacer(guardado: Guardado) {
    const { error } = await supabase.from("lote_despensa").delete().eq("id", guardado.loteId);
    if (error) return toast.error(mensajeError(error));
    setGuardados((lista) => lista.filter((g) => g.loteId !== guardado.loteId));
    refrescar();
  }

  const camara = useCamara((ean) => void alDetectar(ean));
  const seleccionado = pendientes.find((p) => p.ean === abierto);

  return (
    <>
      <div className="px-4 pt-4 md:px-0">
        <Link to="/despensa" className="inline-flex items-center gap-1 text-sm text-suave">
          <ArrowLeft className="size-4" /> Despensa
        </Link>
      </div>
      <Cabecera
        titulo="Escanear"
        subtitulo="Todo lo que escanees va a:"
        accion={camara.motor && <Etiqueta tono="primario">{camara.motor === "nativo" ? "Detector nativo" : "WebAssembly"}</Etiqueta>}
      />

      <div className="flex flex-col gap-4 px-4 md:px-0">
        <Opciones opciones={UBICACIONES} valor={ubicacion} onChange={setUbicacion} className="-mt-2" />

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-black md:aspect-video">
          <video ref={camara.video} playsInline muted className={cn("size-full object-cover", camara.estado !== "escaneando" && "opacity-0")} />

          {camara.estado === "escaneando" && (
            <>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="relative h-36 w-[72%] max-w-sm rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  <span className="absolute inset-0 rounded-2xl border-2 border-white/90" />
                  <motion.span
                    className="absolute inset-x-3 h-0.5 rounded bg-primario shadow-[0_0_12px_2px] shadow-primario"
                    animate={{ top: ["12%", "88%", "12%"] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
              <p className="absolute inset-x-0 bottom-20 text-center text-sm font-medium text-white/90 drop-shadow">Centra el código · a unos 15 cm</p>
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
                {camara.linterna !== null && (
                  <Boton variante="secundario" tamano="icono" className="rounded-full bg-white/90 text-black" onClick={camara.alternarLinterna} aria-label="Linterna">
                    {camara.linterna ? <FlashlightOff /> : <Flashlight />}
                  </Boton>
                )}
                <Boton variante="secundario" tamano="icono" className="rounded-full bg-white/90 text-black" onClick={camara.parar} aria-label="Parar la cámara">
                  <X />
                </Boton>
              </div>
            </>
          )}

          {camara.estado !== "escaneando" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
              {camara.estado === "arrancando" ? (
                <LoaderCircle className="size-8 animate-spin" />
              ) : (
                <>
                  <ScanBarcode className="size-12 opacity-80" />
                  <p className="max-w-xs text-sm text-white/80">
                    {camara.error ?? "Pasa los productos uno tras otro: cada código se detecta solo, con pitido y vibración. Dos pasadas del mismo producto suman uno."}
                  </p>
                  <Boton tamano="lg" onClick={camara.arrancar}>
                    <Camera /> {camara.estado === "error" ? "Reintentar" : "Abrir cámara"}
                  </Boton>
                </>
              )}
            </div>
          )}
        </div>

        {pendientes.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-suave uppercase">Pendientes de confirmar · {pendientes.length}</h2>
            <ul className="flex flex-col gap-2">
              {pendientes.map((p) => (
                <li key={p.ean}>
                  <button onClick={() => abrir(p.ean)} className="w-full text-left">
                    <Tarjeta className="flex items-center gap-3 border-aviso/40 p-3">
                      <ScanBarcode className="size-5 text-aviso" />
                      <span className="min-w-0 flex-1 truncate font-medium">{nombreEscaneado(p)}</span>
                      <span className="font-mono text-xs text-suave">{p.ean}</span>
                    </Tarjeta>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {guardados.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-suave uppercase">Añadido en esta sesión · {guardados.length}</h2>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {guardados.map((g) => (
                  <motion.li key={g.loteId} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -40 }}>
                    <Tarjeta className="flex items-center gap-3 p-3">
                      {g.producto.foto_url ? (
                        <img src={g.producto.foto_url} alt="" className="size-11 rounded-xl bg-white object-contain" />
                      ) : (
                        <div className="grid size-11 place-items-center rounded-xl bg-primario-suave text-primario">
                          <ScanBarcode className="size-4" />
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{g.producto.nombre}</span>
                      <Etiqueta tono="primario">×{g.envases}</Etiqueta>
                      <Boton variante="fantasma" tamano="icono-sm" aria-label={`Deshacer ${g.producto.nombre}`} onClick={() => deshacer(g)}>
                        <Undo2 />
                      </Boton>
                    </Tarjeta>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}
      </div>

      {/* No modal: la cámara sigue visible y detectando detrás del panel (§7.2). */}
      <Hoja modal={false} abierta={seleccionado !== undefined} onAbiertaChange={(v) => !v && setAbierto(null)} titulo={seleccionado ? tituloPanel(seleccionado) : ""}>
        {seleccionado && <PanelEscaneo escaneado={seleccionado} ubicacion={ubicacion} envasesExtra={repeticiones} onGuardado={(g) => alGuardar(g)} />}
      </Hoja>
    </>
  );
}

async function consultar(ean: string): Promise<Escaneado> {
  try {
    const respuesta = await fetch(`/api/producto?ean=${ean}`);
    if (respuesta.status === 404) return { ean, estado: "desconocido" };
    if (!respuesta.ok) return { ean, estado: "desconocido", aviso: "Open Food Facts no responde ahora mismo." };
    return { ean, estado: "externo", externo: (await respuesta.json()) as ProductoExterno };
  } catch {
    return { ean, estado: "desconocido", aviso: "Sin conexión para buscar el producto." };
  }
}

function nombreEscaneado(p: Escaneado): string {
  if (p.estado === "propio") return p.producto.nombre;
  if (p.estado === "externo") return p.externo.nombre ?? "Producto sin nombre";
  if (p.estado === "buscando") return "Buscando…";
  return "Desconocido";
}

function tituloPanel(p: Escaneado): string {
  if (p.estado === "propio") return "Añadir a la despensa";
  if (p.estado === "externo") return "Producto nuevo";
  if (p.estado === "buscando") return "Buscando…";
  return "Producto desconocido";
}
