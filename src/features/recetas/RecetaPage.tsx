import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Baby, Check, Clock, CookingPot, Download, EllipsisVertical, Hourglass, Pencil, Timer, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { BarraApp, BotonBarra, EnlaceBarra } from "@/components/BarraApp";
import { Boton } from "@/components/ui/boton";
import { Menu, MenuContenido, MenuDisparador, MenuOpcion } from "@/components/ui/menu";
import { Contador } from "@/components/ui/campos";
import { Estrellas } from "@/components/ui/estrellas";
import { Etiqueta, Tarjeta, Vacio } from "@/components/ui/varios";
import { diasHasta, hoyISO, sumarDias } from "@/dominio/caducidad";
import { alergenosDeReceta } from "@/dominio/alergenos";
import { alimentosNuevos, esRecetaDeBebe } from "@/dominio/bebe";
import { escalar } from "@/dominio/menu";
import { supabase } from "@/lib/supabase";
import { useHogar } from "../hogar/HogarProvider";
import { FichaEsqueleto } from "../productos/ProductoPage";
import { UnirIngredienteHoja } from "../productos/UnirIngredienteHoja";
import { formatearCantidad } from "@/dominio/unidades";
import { cn } from "@/lib/utils";
import { useAlergenosIngredientes, useIngredientes, useLotes, useRecetas } from "../datos";
import { stockDeLotes } from "../despensa/stock";
import { ChipsAlergenos } from "../salud/Alergenos";
import { NutricionReceta } from "../salud/NutricionReceta";
import { AnadirLoQueFalta } from "./AnadirLoQueFalta";
import { aMarkdown, descargar, nombreArchivo } from "./markdown";

export function RecetaPage() {
  const { id } = useParams();
  const { data: recetas, isPending } = useRecetas();
  const { data: lotes = [] } = useLotes();
  const { data: ingredientes = [] } = useIngredientes();
  const receta = recetas?.find((r) => r.id === id);
  const [raciones, setRaciones] = useState<number | null>(null);
  const [mirando, setMirando] = useState<{ id: string; necesario: number } | null>(null);
  const { hogar } = useHogar();
  const hoy = hoyISO();

  // Cuántas veces se ha cocinado en el último año (las sobras no cuentan como otra vez).
  const { data: historial } = useQuery({
    queryKey: ["franjas", hogar.id, "historial-receta", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franja_menu")
        .select("fecha")
        .eq("receta_id", id!)
        .eq("cocinado", true)
        .is("es_sobra_de", null)
        .gte("fecha", sumarDias(hoy, -365))
        .order("fecha", { ascending: false });
      if (error) throw error;
      return { veces: data.length, ultima: (data[0]?.fecha as string | undefined) ?? null };
    },
  });
  const alergenosIngrediente = useAlergenosIngredientes();
  const describirHace = (fecha: string) => {
    const dias = diasHasta(hoy, fecha);
    return dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
  };

  if (isPending) return <FichaEsqueleto />;
  if (!receta) return <Vacio icono={<ArrowLeft />} titulo="Esta receta ya no existe" />;

  const racionesVista = raciones ?? receta.raciones;
  const alergenos = alergenosDeReceta(
    receta.ingredientes.map((ri) => ({ opcional: ri.opcional, alergenos: alergenosIngrediente.get(ri.ingrediente_id) ?? [] })),
  );
  const stock = stockDeLotes(lotes);
  const basicos = new Set(ingredientes.filter((i) => i.siempre_disponible).map((i) => i.id));
  const nuevosBebe =
    hogar.bebe_nombre && esRecetaDeBebe(receta)
      ? alimentosNuevos(receta.ingredientes, new Map(ingredientes.map((i) => [i.id, i.bebe_introducido]))).map(
          (id) => ingredientes.find((i) => i.id === id)?.nombre.toLowerCase() ?? "",
        )
      : [];

  const enlaceCocinar = `/recetas/${receta.id}/cocinar?raciones=${racionesVista}`;

  return (
    <>
      <BarraApp
        titulo={receta.nombre}
        atras="/recetas"
        acciones={
          <>
            <EnlaceBarra to={`/recetas/${receta.id}/editar`} etiqueta="Editar receta">
              <Pencil />
            </EnlaceBarra>
            <Menu>
              <MenuDisparador asChild>
                <BotonBarra etiqueta="Más opciones">
                  <EllipsisVertical />
                </BotonBarra>
              </MenuDisparador>
              <MenuContenido>
                <MenuOpcion onSelect={() => descargar(nombreArchivo(receta.nombre), aMarkdown(receta))}>
                  <Download /> Descargar la receta (.md)
                </MenuOpcion>
              </MenuContenido>
            </Menu>
          </>
        }
        principal={
          <Boton asChild tamano="sm">
            <Link to={enlaceCocinar}>
              <CookingPot /> Cocinar
            </Link>
          </Boton>
        }
      />
      <article className="flex flex-col gap-5 px-4 md:px-0">
        {receta.foto_url && <img src={receta.foto_url} alt="" className="aspect-[16/10] w-full rounded-3xl object-cover" />}

        <header className="-mt-2 flex flex-col gap-2 md:mt-0">
          {historial && (
            <p className="text-[15px] text-suave">
              {historial.veces
                ? `Cocinada ${historial.veces} ${historial.veces === 1 ? "vez" : "veces"} este año · la última ${describirHace(historial.ultima!)}`
                : "Aún no la habéis cocinado este año"}
              {receta.fuente_url && (
                <>
                  {" · "}
                  <a href={receta.fuente_url} target="_blank" rel="noreferrer" className="font-medium text-primario">
                    receta original
                  </a>
                </>
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-suave">
            {receta.valoracion && <Estrellas valor={receta.valoracion} />}
            {receta.tiempo_prep_min ? (
              <span className="flex items-center gap-1">
                <Clock className="size-4" /> {receta.tiempo_prep_min} min preparación
              </span>
            ) : null}
            {receta.tiempo_coccion_min ? (
              <span className="flex items-center gap-1">
                <Timer className="size-4" /> {receta.tiempo_coccion_min} min cocción
              </span>
            ) : null}
          </div>
          {receta.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {receta.etiquetas.map((e) => (
                <Etiqueta key={e}>{e}</Etiqueta>
              ))}
            </div>
          )}
        </header>

        {receta.preparacion_previa && (
          <Tarjeta className="flex gap-3 bg-aviso-suave p-3.5 text-aviso md:border-aviso/30">
            <Hourglass className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm font-medium">
              {receta.preparacion_previa}
              {receta.preparacion_previa_horas ? ` (${receta.preparacion_previa_horas} h antes)` : ""}
            </p>
          </Tarjeta>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[19px] font-semibold">Ingredientes</h2>
            <div className="w-44">
              <Contador
                etiqueta="raciones"
                valor={racionesVista}
                onChange={(v) => setRaciones(Math.max(1, Math.round(v)))}
                min={1}
                sufijo={<Users className="size-4" />}
              />
            </div>
          </div>
          <Tarjeta className="divide-y divide-borde/70">
            {receta.ingredientes.map((ri) => {
              const cantidad = escalar(ri.cantidad, receta.raciones, racionesVista);
              const hay = basicos.has(ri.ingrediente_id) || (stock.get(ri.ingrediente_id) ?? 0) >= cantidad;
              return (
                <button
                  key={ri.id}
                  type="button"
                  onClick={() => setMirando({ id: ri.ingrediente_id, necesario: cantidad })}
                  className="pulsable flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left text-[16px]"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full",
                      hay ? "bg-primario-suave text-primario" : "border-2 border-borde",
                    )}
                    aria-hidden
                  >
                    {hay && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="sr-only">{hay ? "Hay en casa" : "No hay suficiente en casa"}</span>
                  <span className="flex-1">
                    {ri.ingrediente.nombre}
                    {ri.opcional && <span className="text-sm text-suave"> (opcional)</span>}
                  </span>
                  <span className="text-sm font-medium text-suave">
                    {formatearCantidad(Math.round(cantidad * 10) / 10, ri.ingrediente.unidad_base)}
                  </span>
                </button>
              );
            })}
          </Tarjeta>
          {receta.ingredientes.some((ri) => !basicos.has(ri.ingrediente_id) && !stock.get(ri.ingrediente_id)) && (
            <p className="px-1 text-sm text-suave">¿Alguno lo tenéis en casa con otro nombre? Tócalo para unirlo con su producto.</p>
          )}
          <AnadirLoQueFalta receta={receta} raciones={racionesVista} stock={stock} basicos={basicos} />
        </section>

        {nuevosBebe.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl bg-aviso-suave p-3 text-sm font-medium text-aviso">
            <Baby className="mt-0.5 size-4 shrink-0" />
            <span>
              {hogar.bebe_nombre} aún no ha probado: {nuevosBebe.join(", ")}.
            </span>
          </p>
        )}

        {(alergenos.contiene.length > 0 || alergenos.opcionales.length > 0) && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[19px] font-semibold">Alérgenos</h2>
            <ChipsAlergenos alergenos={alergenos.contiene} opcionales={alergenos.opcionales} />
          </section>
        )}

        <NutricionReceta receta={receta} />

        {receta.pasos.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[19px] font-semibold">Pasos</h2>
            <ol className="flex flex-col gap-3">
              {receta.pasos.map((p, i) => (
                <li key={p.id} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primario text-sm font-semibold text-primario-texto">
                    {i + 1}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <p className="whitespace-pre-line">{p.texto}</p>
                    {p.temporizador_seg && (
                      <Etiqueta tono="primario" className="mt-1.5">
                        <Timer className="size-3" /> {p.temporizador_nombre ? `${p.temporizador_nombre} · ` : ""}
                        {Math.round(p.temporizador_seg / 60)} min
                      </Etiqueta>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {receta.notas && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[19px] font-semibold">Notas</h2>
            <p className="whitespace-pre-line text-suave">{receta.notas}</p>
          </section>
        )}
        {/* Hueco para la barra inferior con el botón de cocinar. */}
        <div className="h-20 md:hidden" />
      </article>

      <UnirIngredienteHoja
        ingrediente={(mirando && ingredientes.find((i) => i.id === mirando.id)) || null}
        necesario={mirando?.necesario}
        conEnlace
        onCerrar={() => setMirando(null)}
      />

      {/* Móvil: la acción principal, abajo y a mano. */}
      <div className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-borde/70 bg-fondo/90 backdrop-blur-xl md:hidden">
        <div className="px-4 py-3">
          <Boton asChild tamano="lg" className="w-full rounded-2xl">
            <Link to={enlaceCocinar}>
              <CookingPot /> Cocinar · {racionesVista} {racionesVista === 1 ? "ración" : "raciones"}
            </Link>
          </Boton>
        </div>
      </div>
    </>
  );
}
