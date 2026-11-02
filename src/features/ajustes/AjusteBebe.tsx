import { useQueryClient } from "@tanstack/react-query";
import { Baby, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Campo, Entrada, Interruptor } from "@/components/ui/campos";
import { Tarjeta } from "@/components/ui/varios";
import { limpiarNombreBebe } from "@/dominio/bebe";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/utils";
import { useIngredientes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { useUsuario } from "../sesion/SesionProvider";

/** Menú del bebé: activarlo con su nombre (solo admin) y acceso a los alimentos que ya ha probado. */
export function AjusteBebe() {
  const usuario = useUsuario();
  const { hogar, rol } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const [activo, setActivo] = useState(Boolean(hogar.bebe_nombre));
  const [nombre, setNombre] = useState(hogar.bebe_nombre ?? "");
  const probados = ingredientes.filter((i) => i.bebe_introducido).length;

  async function guardar(valor: string | null) {
    if (valor === hogar.bebe_nombre) return;
    const { error } = await supabase.from("hogar").update({ bebe_nombre: valor }).eq("id", hogar.id);
    if (error) return toast.error(mensajeError(error));
    await queryClient.invalidateQueries({ queryKey: ["hogares", usuario.id] });
    if (valor) toast.success(`Menú de ${valor} activado`, { description: "Cada día del menú tiene ahora su comida y su cena." });
  }

  if (rol !== "admin" && !hogar.bebe_nombre) return <p className="px-1 text-sm text-suave">Quien administra el hogar puede activar un menú propio para el bebé.</p>;

  return (
    <Tarjeta className="flex flex-col gap-4 p-4">
      {rol === "admin" && (
        <Interruptor
          marcado={activo}
          etiqueta="Menú de bebé"
          ayuda="Su comida y su cena en cada día del menú, con sus recetas (etiqueta «bebé») y aviso de lo que aún no ha probado."
          onChange={(v) => {
            setActivo(v);
            if (!v) guardar(null);
            else if (limpiarNombreBebe(nombre)) guardar(limpiarNombreBebe(nombre));
          }}
        />
      )}
      {activo && rol === "admin" && (
        <Campo etiqueta="Nombre">
          <Entrada
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => limpiarNombreBebe(nombre) && guardar(limpiarNombreBebe(nombre))}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder="Lucía"
            maxLength={40}
            autoFocus={!hogar.bebe_nombre}
          />
        </Campo>
      )}
      {hogar.bebe_nombre && (
        <Link to="/ajustes/bebe" className="-mx-1 flex min-h-12 items-center gap-3 rounded-xl px-1 active:bg-superficie-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-superficie-2 text-suave">
            <Baby className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Lo que ha probado {hogar.bebe_nombre}</span>
            <span className="block text-xs text-suave">
              {probados ? `${probados} ${probados === 1 ? "alimento" : "alimentos"}` : "Aún nada apuntado"}
            </span>
          </span>
          <ChevronRight className="size-4 text-suave" />
        </Link>
      )}
    </Tarjeta>
  );
}
