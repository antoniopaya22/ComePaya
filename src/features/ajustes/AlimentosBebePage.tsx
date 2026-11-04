import { useQueryClient } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BarraApp } from "@/components/BarraApp";
import { esAlimentoParaBebe } from "@/dominio/bebe";
import { Entrada } from "@/components/ui/campos";
import { FilaBoton, Grupo } from "@/components/ui/lista";
import { hoyISO } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { puntuarBusqueda } from "@/dominio/texto";
import { supabase } from "@/lib/supabase";
import type { Ingrediente } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useAlergenosIngredientes, useIngredientes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { ChipsAlergenos } from "../salud/Alergenos";

const fechaCorta = (fecha: string) => new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/**
 * Alimentos que el bebé ya ha probado (se apuntan solos al marcar cocinada una comida suya) y los que no.
 * Tocar uno lo marca o lo desmarca.
 */
export function AlimentosBebePage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const alergenos = useAlergenosIngredientes();
  const [busqueda, setBusqueda] = useState("");
  const bebe = hogar.bebe_nombre ?? "el bebé";

  const { probados, pendientes } = useMemo(() => {
    const q = busqueda.trim();
    const alimentos = ingredientes.filter(esAlimentoParaBebe);
    const visibles = q ? alimentos.filter((i) => puntuarBusqueda(i.nombre, q) > 0) : alimentos;
    return {
      probados: visibles.filter((i) => i.bebe_introducido).sort((a, b) => b.bebe_introducido!.localeCompare(a.bebe_introducido!)),
      pendientes: visibles.filter((i) => !i.bebe_introducido).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    };
  }, [ingredientes, busqueda]);

  async function alternar(i: Ingrediente) {
    const { error } = await supabase
      .from("ingrediente")
      .update({ bebe_introducido: i.bebe_introducido ? null : hoyISO() })
      .eq("id", i.id);
    if (error) return toast.error(mensajeError(error));
    void queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
  }

  const fila = (i: Ingrediente) => (
    <FilaBoton
      key={i.id}
      onClick={() => alternar(i)}
      inicio={emojiPara(i.nombre, i.seccion_super, i.emoji)}
      titulo={i.nombre}
      detalle={(alergenos.get(i.id) ?? []).length ? <ChipsAlergenos alergenos={alergenos.get(i.id)!} /> : undefined}
      fin={
        i.bebe_introducido ? (
          <>
            {fechaCorta(i.bebe_introducido)} <Check className="size-4 text-primario" />
          </>
        ) : (
          <span className="text-sm text-primario">Ya lo ha probado</span>
        )
      }
    />
  );

  return (
    <>
      <BarraApp titulo={`Lo que ha probado ${bebe}`} atras="/ajustes" />
      <div className="flex flex-col gap-5">
        <p className="px-4 text-[15px] text-suave md:px-1">
          Se apunta solo al marcar como cocinada una comida de {bebe}. En su menú se avisa de lo que aún no ha probado.
        </p>
        <div className="relative mx-4 md:mx-0">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar alimento"
            className="h-11 rounded-full border-transparent bg-superficie-2 pl-10"
            type="search"
          />
        </div>
        {probados.length > 0 && <Grupo titulo={`Ya probados · ${probados.length}`}>{probados.map(fila)}</Grupo>}
        {pendientes.length > 0 && <Grupo titulo="Aún no">{pendientes.map(fila)}</Grupo>}
      </div>
    </>
  );
}
