import { useQueryClient } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { SECCION_OTROS } from "@/dominio/lista";
import { formatearCantidad } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { RecetaCompleta } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { escalar } from "@/dominio/menu";
import { claves, useIngredientes, useLista } from "../datos";
import { useHogar } from "../hogar/HogarProvider";

/**
 * "Añadir lo que falta a la lista": lo que la receta pide (para las raciones que se ven) y no hay en casa,
 * menos lo que ya está pendiente en la lista. Se puede deshacer.
 */
export function AnadirLoQueFalta({
  receta,
  raciones,
  stock,
  basicos,
}: {
  receta: RecetaCompleta;
  raciones: number;
  stock: Map<string, number>;
  basicos: Set<string>;
}) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: lista = [] } = useLista();
  const { data: ingredientes = [] } = useIngredientes();
  const [anadiendo, setAnadiendo] = useState(false);

  const enLista = new Set(lista.filter((i) => !i.marcado && i.ingrediente_id).map((i) => i.ingrediente_id));
  const necesario = new Map<string, { cantidad: number; ri: RecetaCompleta["ingredientes"][number] }>();
  for (const ri of receta.ingredientes) {
    if (ri.opcional || basicos.has(ri.ingrediente_id)) continue;
    const previo = necesario.get(ri.ingrediente_id);
    necesario.set(ri.ingrediente_id, { cantidad: (previo?.cantidad ?? 0) + escalar(ri.cantidad, receta.raciones, raciones), ri });
  }
  const faltan = [...necesario.entries()]
    .map(([id, n]) => ({ id, ri: n.ri, falta: Math.round((n.cantidad - (stock.get(id) ?? 0)) * 10) / 10 }))
    .filter((f) => f.falta > 0 && !enLista.has(f.id));

  if (!faltan.length) return null;

  async function anadir() {
    setAnadiendo(true);
    const filas = faltan.map((f) => ({
      id: crypto.randomUUID(),
      hogar_id: hogar.id,
      texto: f.ri.ingrediente.nombre,
      cantidad: formatearCantidad(f.falta, f.ri.ingrediente.unidad_base),
      cantidad_base: f.falta,
      ingrediente_id: f.id,
      seccion_super: ingredientes.find((i) => i.id === f.id)?.seccion_super ?? SECCION_OTROS,
      origen: "manual" as const,
    }));
    const { error } = await supabase.from("item_lista").insert(filas);
    setAnadiendo(false);
    if (error) return toast.error(mensajeError(error));
    const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });
    refrescar();
    toast.success(`${filas.length} ${filas.length === 1 ? "añadido" : "añadidos"} a la lista`, {
      description: filas.map((f) => f.texto.toLowerCase()).join(", "),
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const { error } = await supabase.from("item_lista").delete().in("id", filas.map((f) => f.id));
          if (error) toast.error(mensajeError(error));
          refrescar();
        },
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Boton variante="secundario" onClick={anadir} disabled={anadiendo}>
        <ListPlus /> Añadir lo que falta a la lista ({faltan.length})
      </Boton>
      {enLista.size > 0 && receta.ingredientes.some((ri) => enLista.has(ri.ingrediente_id)) && (
        <Link to="/lista" className="text-sm font-medium text-primario">
          Algunos ya están en la lista
        </Link>
      )}
    </div>
  );
}
