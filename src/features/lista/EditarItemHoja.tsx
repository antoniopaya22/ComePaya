import { useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Selector } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { seccionesDisponibles } from "@/dominio/lista";
import { supabase } from "@/lib/supabase";
import type { ItemLista } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useIngredientes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";

export function EditarItemHoja({ item, onCerrar, ordenSecciones }: { item: ItemLista | null; onCerrar: () => void; ordenSecciones: string[] }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const [texto, setTexto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [seccion, setSeccion] = useState("");

  useEffect(() => {
    if (item) {
      setTexto(item.texto);
      setCantidad(item.cantidad ?? "");
      setSeccion(item.seccion_super);
    }
  }, [item]);

  const secciones = seccionesDisponibles(ordenSecciones, [...ingredientes.map((i) => i.seccion_super), seccion]);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });

  async function guardar() {
    if (!item) return;
    const { error } = await supabase
      .from("item_lista")
      .update({ texto: texto.trim(), cantidad: cantidad.trim() || null, seccion_super: seccion })
      .eq("id", item.id);
    if (error) return toast.error(mensajeError(error));
    // Si el elemento es un ingrediente conocido, recuerda la sección para la próxima vez.
    if (item.ingrediente_id && seccion !== item.seccion_super) {
      await supabase.from("ingrediente").update({ seccion_super: seccion }).eq("id", item.ingrediente_id);
      queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
    }
    refrescar();
    onCerrar();
  }

  async function borrar() {
    if (!item) return;
    const { error } = await supabase.from("item_lista").delete().eq("id", item.id);
    if (error) return toast.error(mensajeError(error));
    refrescar();
    const copia = { ...item };
    toast(`${item.texto} quitado`, {
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const { error } = await supabase.from("item_lista").insert(copia);
          if (error) toast.error(mensajeError(error));
          refrescar();
        },
      },
    });
    onCerrar();
  }

  return (
    <Hoja
      abierta={item !== null}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo="Editar"
      pie={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Boton variante="peligro" tamano="icono" onClick={borrar} aria-label="Quitar de la lista">
            <Trash2 />
          </Boton>
          <Boton onClick={guardar} disabled={!texto.trim()}>
            <Check /> Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Qué">
          <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        <Campo etiqueta="Cantidad">
          <Entrada value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="2 kg, 1 paquete…" />
        </Campo>
        <Campo etiqueta="Sección del súper" ayuda={item?.ingrediente_id ? "Se recordará para este ingrediente." : undefined}>
          <Selector value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            {secciones.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Selector>
        </Campo>
      </div>
    </Hoja>
  );
}
