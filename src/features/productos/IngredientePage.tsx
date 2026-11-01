import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChefHat, ListPlus, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Etiqueta, Tarjeta, Vacio } from "@/components/ui/varios";
import { emojiPara } from "@/dominio/ingredientes-base";
import { CLAVES_NUTRIENTES, GRUPOS_ALIMENTO } from "@/dominio/nutricion";
import { formatearCantidad, formatearLote } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/utils";
import { IngredienteHoja } from "../ajustes/IngredientesPage";
import { claves, useIngredientes, useLotes, useNutrientesIngredientes, useProductos, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { FichaEsqueleto } from "./ProductoPage";

/** Ficha de ingrediente: cuánto hay, con qué productos, en qué recetas y qué aporta. */
export function IngredientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes, isPending } = useIngredientes();
  const { data: productos = [] } = useProductos();
  const { data: lotes = [] } = useLotes();
  const { data: recetas = [] } = useRecetas();
  const nutrientes = useNutrientesIngredientes();
  const [editando, setEditando] = useState(false);
  const ingrediente = ingredientes?.find((i) => i.id === id);

  if (isPending) return <FichaEsqueleto />;
  if (!ingrediente) return <Vacio icono={<ArrowLeft />} titulo="Este ingrediente ya no existe" />;

  const suyos = productos.filter((p) => p.ingrediente_id === ingrediente.id);
  const stock = lotes.filter((l) => l.producto.ingrediente_id === ingrediente.id).reduce((t, l) => t + l.cantidad, 0);
  const enRecetas = recetas.filter((r) => r.ingredientes.some((ri) => ri.ingrediente_id === ingrediente.id));
  const n = nutrientes.get(ingrediente.id);
  const grupo = GRUPOS_ALIMENTO.find((g) => g.valor === ingrediente.grupo_alimento)?.etiqueta;

  async function aLaLista() {
    const { error } = await supabase.from("item_lista").insert({
      hogar_id: hogar.id,
      texto: ingrediente!.nombre,
      ingrediente_id: ingrediente!.id,
      seccion_super: ingrediente!.seccion_super,
    });
    if (error) return toast.error(mensajeError(error));
    queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });
    toast.success(`${ingrediente!.nombre} a la lista`);
  }

  return (
    <article className="flex flex-col gap-5 px-4 pt-4 md:px-0">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-suave">
          <ArrowLeft className="size-4" /> Volver
        </button>
        <div className="flex gap-2">
          <Boton variante="secundario" tamano="sm" onClick={aLaLista}>
            <ListPlus /> A la lista
          </Boton>
          <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}>
            <Pencil /> Editar
          </Boton>
        </div>
      </div>

      <header className="flex items-center gap-4">
        <div className="grid size-20 shrink-0 place-items-center rounded-3xl bg-superficie-2 text-5xl">{emojiPara(ingrediente.nombre, ingrediente.seccion_super, ingrediente.emoji)}</div>
        <div className="min-w-0">
          <h1 className="font-titulo text-[26px] leading-tight font-semibold">{ingrediente.nombre}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <Etiqueta>{ingrediente.seccion_super}</Etiqueta>
            {grupo && <Etiqueta tono="primario">{grupo}</Etiqueta>}
            {ingrediente.siempre_disponible && <Etiqueta tono="primario">Básico</Etiqueta>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta className="p-4">
          <p className="text-2xl font-bold">{ingrediente.siempre_disponible ? "Siempre" : stock ? formatearCantidad(stock, ingrediente.unidad_base) : "Nada"}</p>
          <p className="text-sm text-suave">en casa</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-2xl font-bold">{ingrediente.stock_minimo ? formatearCantidad(ingrediente.stock_minimo, ingrediente.unidad_base) : "—"}</p>
          <p className="text-sm text-suave">stock mínimo</p>
        </Tarjeta>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Productos</h2>
        {suyos.length ? (
          <Tarjeta className="divide-y divide-borde">
            {suyos.map((p) => {
              const cantidad = lotes.filter((l) => l.producto_id === p.id).reduce((t, l) => t + l.cantidad, 0);
              return (
                <Link key={p.id} to={`/productos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-superficie-2">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt="" className="size-10 rounded-lg bg-white object-contain" />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-lg bg-superficie-2 text-xl">{emojiPara(ingrediente.nombre, ingrediente.seccion_super, ingrediente.emoji)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.nombre}</span>
                    <span className="block text-xs text-suave">{p.marca ?? "Sin marca"}</span>
                  </span>
                  <span className="text-sm text-suave">{cantidad ? formatearLote(cantidad, ingrediente.unidad_base, p.cantidad_envase) : "—"}</span>
                </Link>
              );
            })}
          </Tarjeta>
        ) : (
          <p className="text-sm text-suave">Ninguno todavía. Se crean al añadir a la despensa o al escanear.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">En recetas</h2>
        {enRecetas.length ? (
          <div className="flex flex-wrap gap-2">
            {enRecetas.map((r) => (
              <Link key={r.id} to={`/recetas/${r.id}`} className="flex items-center gap-1.5 rounded-full bg-superficie-2 px-3 py-1.5 text-sm font-medium hover:bg-borde">
                <ChefHat className="size-3.5 text-primario" /> {r.nombre}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-suave">No aparece en ninguna receta.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Por 100 g</h2>
        {n ? (
          <Tarjeta className="grid grid-cols-4 gap-y-3 p-4">
            {CLAVES_NUTRIENTES.filter((c) => n[c.clave] !== undefined).map((c) => (
              <div key={c.clave} className="text-center">
                <p className="font-semibold">{n[c.clave]!.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</p>
                <p className="text-[11px] text-suave">
                  {c.etiqueta} ({c.unidad})
                </p>
              </div>
            ))}
          </Tarjeta>
        ) : (
          <p className="text-sm text-suave">Sin datos nutricionales. Puedes ponerlos al editar o escanear alguno de sus productos.</p>
        )}
        {!ingrediente.nutrientes_100 && n && <p className="text-xs text-suave">Media de sus productos escaneados.</p>}
      </section>

      <IngredienteHoja ingrediente={editando ? ingrediente : null} onCerrar={() => setEditando(false)} />
    </article>
  );
}
