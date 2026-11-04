import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Merge, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Interruptor } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { FilaBoton, Grupo } from "@/components/ui/lista";
import { candidatosUnion, factorFusion, necesitaPesoUnidad } from "@/dominio/fusion";
import { emojiPara } from "@/dominio/ingredientes-base";
import { formatearCantidad } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { Ingrediente, ProductoConIngrediente } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useIngredientes, useLista, useLotes, useProductos, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { fusionarIngredientes } from "./fusionar";

/**
 * Qué hay en casa de un ingrediente y, si no aparece, con qué producto de la despensa (de ahora o de antes)
 * es lo mismo: al unirlos, las recetas reconocen lo que tenéis.
 */
export function UnirIngredienteHoja({
  ingrediente: abierto,
  necesario,
  conEnlace = false,
  onCerrar,
}: {
  ingrediente: Ingrediente | null;
  /** Lo que pide la receta, para decir si llega. */
  necesario?: number;
  /** Enlace a la ficha del ingrediente (desde una receta). */
  conEnlace?: boolean;
  onCerrar: () => void;
}) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: productos = [] } = useProductos();
  const { data: lotes = [] } = useLotes();
  const { data: recetas = [] } = useRecetas();
  const { data: lista = [] } = useLista();
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<{ destino: Ingrediente; producto: ProductoConIngrediente | null } | null>(null);
  const [peso, setPeso] = useState("");
  const [uniendo, setUniendo] = useState(false);
  // El último abierto, para que la hoja se cierre con su animación y no en blanco.
  const [ingrediente, setIngrediente] = useState(abierto);
  if (abierto && abierto !== ingrediente) setIngrediente(abierto);

  const stockPorProducto = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lotes) m.set(l.producto_id, (m.get(l.producto_id) ?? 0) + l.cantidad);
    return m;
  }, [lotes]);
  const candidatos = useMemo(
    () => (ingrediente ? candidatosUnion(ingrediente.id, productos, ingredientes, stockPorProducto, busqueda) : null),
    [ingrediente, productos, ingredientes, stockPorProducto, busqueda],
  );

  /** Qué se va a pasar al otro ingrediente, para unir sabiendo lo que cambia (no se puede deshacer). */
  function resumenUnion(origenId: string, destino: string): string {
    const n = {
      recetas: recetas.filter((r) => r.ingredientes.some((ri) => ri.ingrediente_id === origenId)).length,
      productos: productos.filter((p) => p.ingrediente_id === origenId).length,
      lista: lista.filter((i) => i.ingrediente_id === origenId).length,
    };
    const partes = [
      n.recetas && `${n.recetas} ${n.recetas === 1 ? "receta" : "recetas"}`,
      n.productos && `${n.productos} ${n.productos === 1 ? "producto" : "productos"} con su despensa`,
      n.lista && `${n.lista} de la lista`,
    ].filter(Boolean);
    const que = partes.length ? `Pasarán a «${destino}»: ${partes.join(", ")}.` : `No hay nada más que pasar a «${destino}».`;
    return `${que} Unir no se puede deshacer.`;
  }

  function cerrar() {
    setBusqueda("");
    setElegido(null);
    onCerrar();
  }

  function elegir(destino: Ingrediente | undefined, producto: ProductoConIngrediente | null) {
    if (!destino || !ingrediente) return;
    // Lo que pesa una unidad: lo que trae el envase elegido o lo que ya se sepa de alguno de los dos.
    const sugerido =
      ingrediente.unidad_base === "ud"
        ? (producto?.cantidad_envase ?? ingrediente.peso_unidad_g)
        : (destino.peso_unidad_g ?? ingrediente.peso_unidad_g);
    setPeso(sugerido ? String(sugerido).replace(".", ",") : "");
    setElegido({ destino, producto });
  }

  async function cambiarBasico(v: boolean) {
    const { error } = await supabase.from("ingrediente").update({ siempre_disponible: v }).eq("id", ingrediente!.id);
    if (error) return toast.error(mensajeError(error));
    void queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
  }

  if (!ingrediente) return null;

  const stock = lotes.filter((l) => l.producto.ingrediente_id === ingrediente.id).reduce((t, l) => t + l.cantidad, 0);
  const estado = ingrediente.siempre_disponible
    ? "Básico: siempre hay en casa"
    : stock
      ? `Hay ${formatearCantidad(stock, ingrediente.unidad_base)}${necesario && stock < necesario ? `, hacen falta ${formatearCantidad(Math.round(necesario * 10) / 10, ingrediente.unidad_base)}` : ""}`
      : "No hay en casa";

  const destino = elegido?.destino;
  const pideUnidad = destino ? necesitaPesoUnidad(ingrediente.unidad_base, destino.unidad_base) : false;
  const unidadPeso = destino && (ingrediente.unidad_base === "ud" ? destino.unidad_base : ingrediente.unidad_base);
  const porUnidad = destino && (ingrediente.unidad_base === "ud" ? ingrediente : destino);
  const factor = destino ? factorFusion(ingrediente.unidad_base, destino.unidad_base, Number(peso.replace(",", ".")) || null) : null;

  async function unir() {
    if (!destino || factor === null) return;
    setUniendo(true);
    try {
      await fusionarIngredientes(ingrediente!, destino, factor);
      for (const clave of [claves.recetas, claves.ingredientes, claves.productos, claves.lotes, claves.lista]) {
        void queryClient.invalidateQueries({ queryKey: clave(hogar.id) });
      }
      toast.success(`«${ingrediente!.nombre}» unido con «${destino.nombre}»`);
      cerrar();
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setUniendo(false);
    }
  }

  const filaProducto = (p: ProductoConIngrediente) => (
    <FilaBoton
      key={p.id}
      onClick={() =>
        elegir(
          ingredientes.find((i) => i.id === p.ingrediente_id),
          p,
        )
      }
      inicio={
        p.foto_url ? (
          <img src={p.foto_url} alt="" className="size-full bg-white object-contain p-0.5" />
        ) : (
          emojiPara(p.ingrediente.nombre, p.ingrediente.seccion_super, p.ingrediente.emoji)
        )
      }
      titulo={p.nombre}
      detalle={[p.marca, p.ingrediente.nombre !== p.nombre && p.ingrediente.nombre].filter(Boolean).join(" · ")}
      fin={stockPorProducto.get(p.id) ? formatearCantidad(stockPorProducto.get(p.id)!, p.ingrediente.unidad_base) : undefined}
    />
  );

  return (
    <Hoja
      abierta={abierto !== null}
      onAbiertaChange={(v) => !v && cerrar()}
      titulo={ingrediente.nombre}
      descripcion={elegido ? undefined : estado}
      pie={
        elegido ? (
          <Boton className="w-full" tamano="lg" onClick={() => (factor === null ? toast.error("Escribe cuánto pesa una unidad para poder convertir las cantidades") : unir())} disabled={uniendo}>
            <Merge /> {uniendo ? "Uniendo…" : "Unir"}
          </Boton>
        ) : undefined
      }
    >
      {elegido && destino ? (
        <div className="flex flex-col gap-5">
          <button onClick={() => setElegido(null)} className="-mt-1 inline-flex h-9 items-center gap-1 self-start text-[15px] text-suave">
            <ArrowLeft className="size-4" /> Elegir otro
          </button>
          <p className="text-[16px] leading-relaxed">
            «{ingrediente.nombre}» y «{destino.nombre}» son lo mismo: las recetas, la lista y la despensa usarán <strong>{destino.nombre}</strong>
            {elegido.producto && elegido.producto.nombre !== destino.nombre
              ? `, así que contará lo que tengáis de «${elegido.producto.nombre}».`
              : "."}
          </p>
          <p className="text-sm text-suave">{resumenUnion(ingrediente.id, destino.nombre)}</p>
          {pideUnidad && porUnidad && (
            <Campo
              etiqueta={`¿Cuántos ${unidadPeso} son 1 ud de ${porUnidad.nombre.toLowerCase()}?`}
              ayuda="Por ejemplo, lo que trae un paquete. Sirve para pasar las cantidades de las recetas."
            >
              <Entrada inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="500" autoFocus />
            </Campo>
          )}
        </div>
      ) : (
        <div className="-mx-4 flex flex-col gap-5 md:mx-0">
          <div className="flex flex-col gap-3 px-4 md:px-0">
            <Interruptor
              marcado={ingrediente.siempre_disponible}
              onChange={cambiarBasico}
              etiqueta="Siempre hay en casa"
              ayuda="Como la sal o el aceite: no se pide en la lista."
            />
            {conEnlace && (
              <Link
                to={`/ingredientes/${ingrediente.id}`}
                className="inline-flex h-9 items-center gap-1 self-start text-[15px] font-medium text-primario"
              >
                Ver ingrediente <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-2 px-4 md:px-0">
            <p className="text-[15px] font-medium">¿Lo tenéis con otro nombre? Únelo con su producto.</p>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
              <Entrada
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto o ingrediente"
                className="h-11 rounded-full border-transparent bg-superficie-2 pl-10"
                type="search"
              />
            </div>
          </div>
          {candidatos && candidatos.enCasa.length > 0 && <Grupo titulo="En tu despensa">{candidatos.enCasa.slice(0, 30).map(filaProducto)}</Grupo>}
          {candidatos && candidatos.antes.length > 0 && <Grupo titulo="Comprados antes">{candidatos.antes.slice(0, 30).map(filaProducto)}</Grupo>}
          {candidatos && candidatos.otros.length > 0 && (
            <Grupo titulo="Otros ingredientes">
              {candidatos.otros.map((i) => (
                <FilaBoton
                  key={i.id}
                  onClick={() => elegir(i, null)}
                  inicio={emojiPara(i.nombre, i.seccion_super, i.emoji)}
                  titulo={i.nombre}
                  detalle={i.siempre_disponible ? "Básico" : "Sin productos"}
                />
              ))}
            </Grupo>
          )}
          {candidatos && !candidatos.enCasa.length && !candidatos.antes.length && !candidatos.otros.length && (
            <p className="px-4 text-[15px] text-suave md:px-0">{busqueda.trim() ? "Nada con ese nombre." : "Aún no hay productos en la despensa."}</p>
          )}
        </div>
      )}
    </Hoja>
  );
}
