import { useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Opciones, Selector } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { cantidadEnBase, seccionesDisponibles } from "@/dominio/lista";
import { supabase } from "@/lib/supabase";
import type { ItemLista, Tienda } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useIngredientes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";

export function EditarItemHoja({
  item,
  onCerrar,
  ordenSecciones,
  tiendas = [],
}: {
  item: ItemLista | null;
  onCerrar: () => void;
  ordenSecciones: string[];
  tiendas?: Tienda[];
}) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const [texto, setTexto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [seccion, setSeccion] = useState("");
  // Súper donde se compra ("" = en cualquiera).
  const [tiendaId, setTiendaId] = useState("");

  useEffect(() => {
    if (item) {
      setTexto(item.texto);
      setCantidad(item.cantidad ?? "");
      setSeccion(item.seccion_super);
      setTiendaId(item.tienda_id ?? "");
    }
  }, [item]);

  const secciones = seccionesDisponibles(ordenSecciones, [...ingredientes.map((i) => i.seccion_super), seccion]);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });

  async function guardar() {
    if (!item) return;
    const nuevaCantidad = cantidad.trim() || null;
    const ingrediente = ingredientes.find((i) => i.id === item.ingrediente_id);
    const { data, error } = await supabase
      .from("item_lista")
      .update({
        texto: texto.trim(),
        cantidad: nuevaCantidad,
        seccion_super: seccion,
        tienda_id: tiendaId || null,
        // Si se cambia la cantidad, cuenta la escrita (también al guardar la compra) y el elemento pasa a ser
        // manual: "Completar desde el menú" ya no lo toca.
        ...(nuevaCantidad !== item.cantidad
          ? { cantidad_base: ingrediente ? cantidadEnBase(nuevaCantidad, ingrediente.unidad_base, ingrediente.peso_unidad_g) : null, origen: "manual" }
          : {}),
      })
      .eq("id", item.id)
      .select("id");
    if (error) return toast.error(mensajeError(error));
    if (!data?.length) {
      toast.error("Ya no está en la lista: lo han quitado desde otro móvil");
      refrescar();
      return onCerrar();
    }
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
        {tiendas.length > 0 && (
          <Campo etiqueta="Súper" ayuda="En la lista, al elegir un súper se ve lo suyo y lo que vale en cualquiera.">
            <Opciones opciones={[{ valor: "", etiqueta: "Cualquiera" }, ...tiendas.map((t) => ({ valor: t.id, etiqueta: t.nombre }))]} valor={tiendaId} onChange={setTiendaId} />
          </Campo>
        )}
      </div>
    </Hoja>
  );
}
