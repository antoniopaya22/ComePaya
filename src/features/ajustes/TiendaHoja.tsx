import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { m as motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { SECCION_OTROS, SECCIONES_POR_DEFECTO } from "@/dominio/lista";
import { supabase } from "@/lib/supabase";
import type { Tienda } from "@/lib/tipos";
import { claves } from "../datos";
import { mensajeError } from "@/lib/utils";
import { useHogar } from "../hogar/HogarProvider";

/** Crear o editar una tienda y el orden en que se recorren sus secciones (§4.2). */
export function TiendaHoja({ tienda, onCerrar }: { tienda: Tienda | "nueva" | null; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const [nombre, setNombre] = useState("");
  const [secciones, setSecciones] = useState<string[]>([]);
  const [nueva, setNueva] = useState("");

  useEffect(() => {
    if (tienda === "nueva") {
      setNombre("");
      setSecciones(SECCIONES_POR_DEFECTO);
    } else if (tienda) {
      setNombre(tienda.nombre);
      setSecciones(tienda.orden_secciones.length ? tienda.orden_secciones : SECCIONES_POR_DEFECTO);
    }
  }, [tienda]);

  function mover(indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= secciones.length) return;
    const copia = [...secciones];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setSecciones(copia);
  }

  function anadirSeccion() {
    const limpia = nueva.trim();
    if (!limpia || secciones.includes(limpia)) return;
    const sinOtros = secciones.filter((s) => s !== SECCION_OTROS);
    setSecciones([...sinOtros, limpia, SECCION_OTROS]);
    setNueva("");
  }

  async function guardar() {
    const datos = { nombre: nombre.trim(), orden_secciones: secciones };
    const { error } =
      tienda === "nueva"
        ? await supabase.from("tienda").insert({ ...datos, hogar_id: hogar.id })
        : await supabase.from("tienda").update(datos).eq("id", (tienda as Tienda).id);
    if (error) return toast.error(mensajeError(error));
    toast.success("Tienda guardada");
    onCerrar();
  }

  const queryClient = useQueryClient();

  async function borrar() {
    if (tienda === "nueva" || !tienda) return;
    const { error } = await supabase.from("tienda").delete().eq("id", tienda.id);
    if (error) return toast.error(mensajeError(error));
    const copia = { ...tienda };
    queryClient.invalidateQueries({ queryKey: claves.tiendas(copia.hogar_id) });
    toast(`${copia.nombre} borrada`, {
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const { error } = await supabase.from("tienda").insert(copia);
          if (error) toast.error(mensajeError(error));
          queryClient.invalidateQueries({ queryKey: claves.tiendas(copia.hogar_id) });
        },
      },
    });
    onCerrar();
  }

  return (
    <Hoja
      abierta={tienda !== null}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo={tienda === "nueva" ? "Nueva tienda" : "Tienda"}
      descripcion="Ordena las secciones como las recorres: la lista seguirá ese orden."
      pie={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          {tienda !== "nueva" && (
            <Boton variante="peligro" tamano="icono" onClick={borrar} aria-label="Borrar tienda">
              <Trash2 />
            </Boton>
          )}
          <Boton onClick={guardar} disabled={!nombre.trim()} className={tienda === "nueva" ? "col-span-2" : ""}>
            Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Mercadona" />
        </Campo>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-suave">Secciones, de la entrada a la caja</span>
          <ul className="flex flex-col gap-1.5">
            {secciones.map((s, i) => (
              <motion.li
                key={s}
                layout
                transition={{ type: "spring", stiffness: 600, damping: 40 }}
                className="flex items-center gap-2 rounded-xl border border-borde bg-superficie py-1.5 pr-1.5 pl-3.5"
              >
                <span className="w-5 text-xs text-suave">{i + 1}</span>
                <span className="flex-1 text-[15px]">{s}</span>
                <Boton variante="fantasma" tamano="icono-sm" aria-label={`Subir ${s}`} onClick={() => mover(i, -1)} disabled={i === 0}>
                  <ChevronUp />
                </Boton>
                <Boton variante="fantasma" tamano="icono-sm" aria-label={`Bajar ${s}`} onClick={() => mover(i, 1)} disabled={i === secciones.length - 1}>
                  <ChevronDown />
                </Boton>
                {s !== SECCION_OTROS && (
                  <Boton variante="fantasma" tamano="icono-sm" aria-label={`Quitar ${s}`} onClick={() => setSecciones(secciones.filter((x) => x !== s))}>
                    <X />
                  </Boton>
                )}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <Entrada value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva sección" onKeyDown={(e) => e.key === "Enter" && anadirSeccion()} />
          <Boton variante="secundario" tamano="icono" onClick={anadirSeccion} aria-label="Añadir sección" disabled={!nueva.trim()}>
            <Plus />
          </Boton>
        </div>
      </div>
    </Hoja>
  );
}
