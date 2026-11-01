import { useQueryClient } from "@tanstack/react-query";
import { ChefHat, ChevronLeft, ChevronRight, CircleCheck, ListChecks, Plane, Plus, Repeat } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Cabecera, Tarjeta } from "@/components/ui/varios";
import { hoyISO, sumarDias, type FechaISO } from "@/dominio/caducidad";
import { DIAS_SEMANA, diasDeSemana, lunesDe, type TipoFranja } from "@/dominio/menu";
import { useTiempoReal } from "@/lib/tiempo-real";
import type { FranjaMenu } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, useFranjas, useIngredientes, useLista, useLotes, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { describirGeneracion, generarListaDesdeMenu } from "../lista/generar";
import { EquilibrioSemana } from "../salud/EquilibrioSemana";
import { FranjaHoja } from "./FranjaHoja";

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
  const { data: recetas = [] } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: lotes = [] } = useLotes();
  const { data: items = [] } = useLista();
  useTiempoReal("franja_menu", hogar.id, claves.franjas(hogar.id));
  const [abierta, setAbierta] = useState<{ fecha: FechaISO; tipo: TipoFranja } | null>(null);
  const [generando, setGenerando] = useState(false);

  const buscar = (fecha: FechaISO, tipo: TipoFranja) => franjas.find((f) => f.fecha === fecha && f.tipo === tipo);
  const nombreReceta = (id: string | null) => recetas.find((r) => r.id === id)?.nombre ?? "Receta borrada";
  const planificadas = franjas.filter((f) => f.receta_id || f.fuera_de_casa).length;

  async function generarLista() {
    setGenerando(true);
    try {
      const resultado = await generarListaDesdeMenu({ hogarId: hogar.id, dias: 7, ingredientes, recetas, lotes, items });
      queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });
      toast.success(describirGeneracion(resultado), { description: "Con el menú de los próximos 7 días y lo que hay en casa." });
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <Cabecera
        titulo="Menú"
        subtitulo={`${planificadas} de 14 franjas planificadas`}
        accion={
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

        <ul className="grid gap-3 md:grid-cols-2">
          {diasDeSemana(lunes).map((fecha, i) => {
            const esHoy = fecha === hoy;
            const pasado = fecha < hoy;
            return (
              <li key={fecha}>
                <Tarjeta className={cn("overflow-hidden", esHoy && "border-primario ring-1 ring-primario", pasado && "opacity-60")}>
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
                      origen={(id) => franjas.find((f) => f.id === id)}
                      onClick={() => setAbierta({ fecha, tipo })}
                    />
                  ))}
                </Tarjeta>
              </li>
            );
          })}
        </ul>

        <EquilibrioSemana franjas={franjas} />
      </div>

      <FranjaHoja
        hueco={abierta}
        franja={abierta ? buscar(abierta.fecha, abierta.tipo) : undefined}
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
  origen,
  onClick,
}: {
  tipo: TipoFranja;
  franja: FranjaMenu | undefined;
  nombreReceta: (id: string | null) => string;
  origen: (id: string) => FranjaMenu | undefined;
  onClick: () => void;
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
    contenido = (
      <span className="flex min-w-0 items-center gap-2">
        {franja.es_sobra_de ? <Repeat className="size-4 shrink-0 text-suave" /> : <ChefHat className="size-4 shrink-0 text-primario" />}
        <span className="min-w-0">
          <span className={cn("block truncate font-medium", franja.cocinado && "text-suave line-through")}>{nombreReceta(franja.receta_id)}</span>
          <span className="block truncate text-xs text-suave">
            {franja.es_sobra_de
              ? `Sobras${deOtra ? ` del ${DIAS_SEMANA[(new Date(deOtra.fecha).getUTCDay() + 6) % 7].toLowerCase()}` : ""}`
              : `${franja.raciones} raciones`}
          </span>
        </span>
        {franja.cocinado && <CircleCheck className="ml-auto size-4 shrink-0 text-primario" />}
      </span>
    );
  }

  return (
    <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 border-t border-borde px-4 py-2 text-left transition-colors first-of-type:border-t-0 active:bg-superficie-2">
      <span className="w-14 shrink-0 text-xs font-semibold tracking-wide text-suave uppercase">{tipo}</span>
      <span className="min-w-0 flex-1">{contenido}</span>
    </button>
  );
}
