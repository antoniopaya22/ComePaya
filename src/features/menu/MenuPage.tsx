import { useQueryClient } from "@tanstack/react-query";
import { Baby, ChevronLeft, ChevronRight, CircleCheck, Copy, ListChecks, Plane, Plus, Repeat, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { BarraApp, BotonBarra } from "@/components/BarraApp";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/varios";
import { paraDe, type ParaFranja } from "@/dominio/bebe";
import { hoyISO, sumarDias, type FechaISO } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { DIAS_SEMANA, diasDeSemana, lunesDe, type TipoFranja } from "@/dominio/menu";
import { supabase } from "@/lib/supabase";
import type { FranjaMenu } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, consultarFranjas, useFranjas, useIngredientes, useLotes, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { avisarGeneracion, generarListaDesdeMenu } from "../lista/generar";
import { EquilibrioSemana } from "../salud/EquilibrioSemana";
import { FranjaHoja } from "./FranjaHoja";
import { PlanificarHoja } from "./PlanificarHoja";

const MESES = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];

function rangoSemana(lunes: FechaISO): string {
  const domingo = sumarDias(lunes, 6);
  const [, m1, d1] = lunes.split("-").map(Number);
  const [, m2, d2] = domingo.split("-").map(Number);
  return m1 === m2 ? `${d1}–${d2} de ${MESES[m1 - 1]}` : `${d1} ${MESES[m1 - 1]} – ${d2} ${MESES[m2 - 1]}`;
}

export function MenuPage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const hoy = hoyISO();
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const { data: franjas = [] } = useFranjas(lunes);
  // Solo se ofrece copiar la semana anterior si tiene algo que copiar.
  const { data: anteriores = [] } = useFranjas(sumarDias(lunes, -7));
  const { data: recetas = [] } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: lotes = [] } = useLotes();
  const [abierta, setAbierta] = useState<{ fecha: FechaISO; tipo: TipoFranja; para: ParaFranja } | null>(null);
  // /menu?franja=… (al terminar el modo cocina): abre esa comida para marcarla como cocinada.
  const [params, setParams] = useSearchParams();
  const franjaPedida = params.get("franja");
  useEffect(() => {
    const f = franjaPedida && franjas.find((x) => x.id === franjaPedida);
    if (!f) return;
    setAbierta({ fecha: f.fecha, tipo: f.tipo, para: paraDe(f) });
    setParams({}, { replace: true });
  }, [franjaPedida, franjas, setParams]);
  const [generando, setGenerando] = useState(false);

  const buscar = (fecha: FechaISO, tipo: TipoFranja, para: ParaFranja = "casa") =>
    franjas.find((f) => f.fecha === fecha && f.tipo === tipo && paraDe(f) === para);
  const deCasa = franjas.filter((f) => paraDe(f) === "casa");
  const nombreReceta = (id: string | null) => recetas.find((r) => r.id === id)?.nombre ?? "Receta borrada";
  const planificadas = deCasa.filter((f) => f.receta_id || f.fuera_de_casa).length;
  const [copiando, setCopiando] = useState(false);
  const [planificando, setPlanificando] = useState(false);

  // Al abrir, llevar la vista al día de hoy (el domingo, la semana ya va muy abajo).
  useEffect(() => {
    if (lunes !== lunesDe(hoy) || hoy === lunes) return;
    const t = setTimeout(() => document.getElementById(`dia-${hoy}`)?.scrollIntoView({ block: "center" }), 150);
    return () => clearTimeout(t);
  }, []);

  const emojiIngrediente = new Map(ingredientes.map((i) => [i.id, emojiPara(i.nombre, i.seccion_super, i.emoji)]));
  /** Foto del plato o, sin foto, el icono de su ingrediente principal. */
  const miniatura = (recetaId: string | null): { foto: string | null; emoji: string } => {
    const r = recetas.find((x) => x.id === recetaId);
    const principal = r ? [...r.ingredientes].filter((i) => !i.opcional).sort((a, b) => b.cantidad - a.cantidad)[0] : undefined;
    return { foto: r?.foto_url ?? null, emoji: (principal && emojiIngrediente.get(principal.ingrediente_id)) ?? "🍽️" };
  };

  /** Copia las comidas de la semana anterior a esta (sin marcar como cocinadas y sin pisar lo ya planificado). */
  async function copiarSemanaAnterior() {
    setCopiando(true);
    try {
      const anteriores = await consultarFranjas(hogar.id, sumarDias(lunes, -7), sumarDias(lunes, -1));
      if (!anteriores.length) return toast.info("La semana anterior está vacía");
      const { error } = await supabase.from("franja_menu").upsert(
        anteriores.map((f) => ({
          hogar_id: hogar.id,
          fecha: sumarDias(f.fecha, 7),
          tipo: f.tipo,
          para: paraDe(f),
          receta_id: f.receta_id,
          raciones: f.raciones,
          fuera_de_casa: f.fuera_de_casa,
        })),
        { onConflict: "hogar_id,fecha,tipo,para", ignoreDuplicates: true },
      );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: claves.franjas(hogar.id) });
      toast.success("Semana copiada", { description: "Las sobras se copian como platos normales: revísalas si hace falta." });
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setCopiando(false);
    }
  }

  async function generarLista() {
    setGenerando(true);
    try {
      const resultado = await generarListaDesdeMenu({ hogarId: hogar.id, dias: 7, ingredientes, recetas, lotes });
      const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });
      await refrescar();
      avisarGeneracion(resultado, refrescar);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <BarraApp
        titulo="Menú"
        subtitulo={`${planificadas} de 14 comidas y cenas planificadas`}
        acciones={
          <>
            <BotonBarra etiqueta="Rellenar la semana" onClick={() => setPlanificando(true)}>
              <Sparkles />
            </BotonBarra>
            <BotonBarra etiqueta="Pasar a la lista" onClick={generarLista} disabled={generando} className={cn("md:hidden", generando && "animate-pulse")}>
              <ListChecks />
            </BotonBarra>
          </>
        }
        principal={
          <Boton variante="secundario" tamano="sm" onClick={generarLista} disabled={generando}>
            <ListChecks /> {generando ? "Calculando…" : "A la lista"}
          </Boton>
        }
      />

      <div className="flex flex-col gap-4 px-4 md:px-0">
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-superficie-2 p-1">
          <Boton variante="fantasma" tamano="icono-sm" aria-label="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))}>
            <ChevronLeft />
          </Boton>
          <button onClick={() => setLunes(lunesDe(hoy))} className="text-sm font-semibold">
            {lunes === lunesDe(hoy) ? "Esta semana" : rangoSemana(lunes)}
            {lunes === lunesDe(hoy) && <span className="ml-1.5 font-normal text-suave">{rangoSemana(lunes)}</span>}
          </button>
          <Boton variante="fantasma" tamano="icono-sm" aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))}>
            <ChevronRight />
          </Boton>
        </div>

        {/* Tira de días: de un vistazo qué está planificado; tocar un día lleva a él. */}
        <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 grid grid-cols-7 gap-1 bg-fondo/90 px-4 py-1.5 backdrop-blur-xl md:hidden">
          {diasDeSemana(lunes).map((fecha, i) => (
            <button
              key={fecha}
              onClick={() => document.getElementById(`dia-${fecha}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className={cn("flex flex-col items-center rounded-2xl py-1.5", fecha === hoy ? "bg-primario text-primario-texto" : fecha < hoy ? "text-suave" : "")}
            >
              <span className="text-[11px] font-semibold">{DIAS_SEMANA[i].slice(0, 1)}</span>
              <span className="text-sm font-semibold">{Number(fecha.slice(8))}</span>
              <span className="mt-0.5 flex gap-0.5">
                {(["comida", "cena"] as const).map((tipo) => {
                  const f = buscar(fecha, tipo);
                  return (
                    <span
                      key={tipo}
                      className={cn(
                        "size-1.5 rounded-full",
                        f?.receta_id || f?.fuera_de_casa ? (fecha === hoy ? "bg-primario-texto" : "bg-primario") : fecha === hoy ? "bg-primario-texto/30" : "bg-borde",
                      )}
                    />
                  );
                })}
              </span>
            </button>
          ))}
        </div>

        {planificadas === 0 && anteriores.some((f) => f.receta_id || f.fuera_de_casa) && (
          <Tarjeta className="flex items-center gap-3 p-3.5">
            <Copy className="size-5 shrink-0 text-primario" />
            <p className="flex-1 text-sm">¿Repetís lo de la semana anterior?</p>
            <Boton variante="secundario" tamano="sm" onClick={copiarSemanaAnterior} disabled={copiando}>
              {copiando ? "Copiando…" : "Copiar"}
            </Boton>
          </Tarjeta>
        )}

        <ul className="grid gap-3 md:grid-cols-2">
          {diasDeSemana(lunes).map((fecha, i) => {
            const esHoy = fecha === hoy;
            const pasado = fecha < hoy;
            return (
              <li key={fecha} id={`dia-${fecha}`} className="scroll-mt-36">
                <Tarjeta className={cn("overflow-hidden", esHoy && "ring-2 ring-primario md:border-primario md:ring-1", pasado && "opacity-60")}>
                  <div className="flex items-baseline justify-between px-4 pt-3 pb-1">
                    <p className="font-semibold">
                      {DIAS_SEMANA[i]} <span className="font-normal text-suave">{Number(fecha.slice(8))}</span>
                    </p>
                    {esHoy && <span className="text-xs font-semibold text-primario">HOY</span>}
                  </div>
                  {(["comida", "cena"] as const).map((tipo) => (
                    <Franja
                      key={tipo}
                      tipo={tipo}
                      franja={buscar(fecha, tipo)}
                      nombreReceta={nombreReceta}
                      miniatura={miniatura}
                      origen={(id) => franjas.find((f) => f.id === id)}
                      onClick={() => setAbierta({ fecha, tipo, para: "casa" })}
                    />
                  ))}
                  {hogar.bebe_nombre && (
                    <div className="border-t border-borde bg-superficie-2/40">
                      <p className="flex items-center gap-1.5 px-4 pt-2 text-xs font-semibold text-suave">
                        <Baby className="size-3.5" /> {hogar.bebe_nombre}
                      </p>
                      {(["comida", "cena"] as const).map((tipo) => (
                        <Franja
                          key={tipo}
                          tipo={tipo}
                          franja={buscar(fecha, tipo, "bebe")}
                          nombreReceta={nombreReceta}
                          miniatura={miniatura}
                          origen={(id) => franjas.find((f) => f.id === id)}
                          onClick={() => setAbierta({ fecha, tipo, para: "bebe" })}
                          etiqueta={`${tipo} de ${hogar.bebe_nombre}`}
                        />
                      ))}
                    </div>
                  )}
                </Tarjeta>
              </li>
            );
          })}
        </ul>

        <EquilibrioSemana franjas={deCasa} />
      </div>

      <PlanificarHoja abierta={planificando} lunes={lunes} franjas={franjas} onCerrar={() => setPlanificando(false)} />
      <FranjaHoja
        hueco={abierta}
        franja={abierta ? buscar(abierta.fecha, abierta.tipo, abierta.para) : undefined}
        franjasSemana={franjas}
        onCerrar={() => setAbierta(null)}
      />
    </>
  );
}

function Franja({
  tipo,
  franja,
  nombreReceta,
  miniatura,
  origen,
  onClick,
  etiqueta,
}: {
  tipo: TipoFranja;
  franja: FranjaMenu | undefined;
  nombreReceta: (id: string | null) => string;
  miniatura: (recetaId: string | null) => { foto: string | null; emoji: string };
  origen: (id: string) => FranjaMenu | undefined;
  onClick: () => void;
  /** Nombre accesible de la fila (la del bebé dice de quién es). */
  etiqueta?: string;
}) {
  let contenido;
  if (!franja || (!franja.receta_id && !franja.fuera_de_casa)) {
    contenido = (
      <span className="flex items-center gap-1.5 text-suave">
        <Plus className="size-4" /> Planificar
      </span>
    );
  } else if (franja.fuera_de_casa) {
    contenido = (
      <span className="flex items-center gap-1.5 text-suave">
        <Plane className="size-4" /> Fuera de casa
      </span>
    );
  } else {
    const deOtra = franja.es_sobra_de ? origen(franja.es_sobra_de) : undefined;
    const { foto, emoji } = miniatura(franja.receta_id);
    contenido = (
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="relative shrink-0">
          {foto ? (
            <img src={foto} alt="" className="size-10 rounded-xl object-cover" loading="lazy" />
          ) : (
            <span className="grid size-10 place-items-center rounded-xl bg-superficie-2 text-xl">{emoji}</span>
          )}
          {franja.es_sobra_de && (
            <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-superficie text-suave shadow">
              <Repeat className="size-3" />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate font-medium", franja.cocinado && "text-suave line-through")}>{nombreReceta(franja.receta_id)}</span>
          <span className="block truncate text-xs text-suave">
            {franja.es_sobra_de
              ? `Sobras${deOtra ? ` del ${DIAS_SEMANA[(new Date(deOtra.fecha).getUTCDay() + 6) % 7].toLowerCase()}` : ""}`
              : `${franja.raciones} ${franja.raciones === 1 ? "ración" : "raciones"}`}
          </span>
        </span>
        {franja.cocinado && <CircleCheck className="ml-auto size-4 shrink-0 text-primario" />}
      </span>
    );
  }

  return (
    <button onClick={onClick} aria-label={etiqueta} className="flex min-h-14 w-full items-center gap-3 border-t border-borde px-4 py-2 text-left transition-colors first-of-type:border-t-0 active:bg-superficie-2">
      <span className="w-14 shrink-0 text-xs font-semibold tracking-wide text-suave uppercase">{tipo}</span>
      <span className="min-w-0 flex-1">{contenido}</span>
    </button>
  );
}
