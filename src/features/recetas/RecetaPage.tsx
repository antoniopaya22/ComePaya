import { ArrowLeft, Check, Clock, CookingPot, Download, Hourglass, Pencil, Timer, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { Boton } from "@/components/ui/boton";
import { Contador } from "@/components/ui/campos";
import { Estrellas } from "@/components/ui/estrellas";
import { Cargando, Etiqueta, Tarjeta, Vacio } from "@/components/ui/varios";
import { escalar } from "@/dominio/menu";
import { formatearCantidad } from "@/dominio/unidades";
import { cn } from "@/lib/utils";
import { useIngredientes, useLotes, useRecetas } from "../datos";
import { stockDeLotes } from "../despensa/stock";
import { NutricionReceta } from "../salud/NutricionReceta";
import { aMarkdown, descargar, nombreArchivo } from "./markdown";

export function RecetaPage() {
  const { id } = useParams();
  const { data: recetas, isPending } = useRecetas();
  const { data: lotes = [] } = useLotes();
  const { data: ingredientes = [] } = useIngredientes();
  const receta = recetas?.find((r) => r.id === id);
  const [raciones, setRaciones] = useState<number | null>(null);

  if (isPending) return <Cargando />;
  if (!receta) return <Vacio icono={<ArrowLeft />} titulo="Esta receta ya no existe" />;

  const racionesVista = raciones ?? receta.raciones;
  const stock = stockDeLotes(lotes);
  const basicos = new Set(ingredientes.filter((i) => i.siempre_disponible).map((i) => i.id));

  return (
    <article className="flex flex-col gap-5 px-4 pt-4 md:px-0">
      <div className="flex items-center justify-between">
        <Link to="/recetas" className="inline-flex items-center gap-1 text-sm text-suave">
          <ArrowLeft className="size-4" /> Recetas
        </Link>
        <div className="flex gap-2">
          <Boton variante="fantasma" tamano="icono-sm" aria-label="Exportar en Markdown" title="Exportar (.md)" onClick={() => descargar(nombreArchivo(receta.nombre), aMarkdown(receta))}>
            <Download />
          </Boton>
          <Boton asChild variante="secundario" tamano="sm">
            <Link to={`/recetas/${receta.id}/editar`}>
              <Pencil /> Editar
            </Link>
          </Boton>
          <Boton asChild tamano="sm">
            <Link to={`/recetas/${receta.id}/cocinar?raciones=${racionesVista}`}>
              <CookingPot /> Cocinar
            </Link>
          </Boton>
        </div>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{receta.nombre}</h1>
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
        <Tarjeta className="flex gap-3 border-aviso/30 bg-aviso-suave p-3.5 text-aviso">
          <Hourglass className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-medium">
            {receta.preparacion_previa}
            {receta.preparacion_previa_horas ? ` (${receta.preparacion_previa_horas} h antes)` : ""}
          </p>
        </Tarjeta>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ingredientes</h2>
          <div className="w-44">
            <Contador valor={racionesVista} onChange={(v) => setRaciones(Math.max(1, Math.round(v)))} min={1} sufijo={<Users className="size-4" />} />
          </div>
        </div>
        <Tarjeta className="divide-y divide-borde">
          {receta.ingredientes.map((ri) => {
            const cantidad = escalar(ri.cantidad, receta.raciones, racionesVista);
            const hay = basicos.has(ri.ingrediente_id) || (stock.get(ri.ingrediente_id) ?? 0) >= cantidad;
            return (
              <div key={ri.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn("grid size-5 shrink-0 place-items-center rounded-full", hay ? "bg-primario-suave text-primario" : "border-2 border-borde")}
                  title={hay ? "Hay en casa" : "No hay suficiente en casa"}
                >
                  {hay && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  {ri.ingrediente.nombre}
                  {ri.opcional && <span className="text-sm text-suave"> (opcional)</span>}
                </span>
                <span className="text-sm font-medium text-suave">{formatearCantidad(Math.round(cantidad * 10) / 10, ri.ingrediente.unidad_base)}</span>
              </div>
            );
          })}
        </Tarjeta>
      </section>

      <NutricionReceta receta={receta} />

      {receta.pasos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Pasos</h2>
          <ol className="flex flex-col gap-3">
            {receta.pasos.map((p, i) => (
              <li key={p.id} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primario text-sm font-semibold text-primario-texto">{i + 1}</span>
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
          <h2 className="text-lg font-semibold">Notas</h2>
          <p className="whitespace-pre-line text-suave">{receta.notas}</p>
        </section>
      )}
    </article>
  );
}
