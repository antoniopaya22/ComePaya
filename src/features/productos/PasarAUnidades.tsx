import { useQueryClient } from "@tanstack/react-query";
import { Hash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/varios";
import { pendientesDePasarAUnidades } from "@/dominio/ingredientes-base";
import { cn, mensajeError } from "@/lib/utils";
import { claves, useIngredientes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { cambiarUnidad } from "./fusionar";

/**
 * Aviso para pasar a unidades lo que se cuenta por piezas (patatas, cebollas, calabacines…) y estaba en gramos:
 * convierte recetas, despensa y lista con lo que pesa una pieza. Desaparece cuando no queda ninguno.
 */
export function PasarAUnidades({ className }: { className?: string }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const [pasando, setPasando] = useState(false);
  const pendientes = pendientesDePasarAUnidades(ingredientes);
  if (!pendientes.length) return null;

  const nombres = pendientes.map((p) => p.ingrediente.nombre.toLowerCase());
  const resumen = nombres.length <= 3 ? nombres.join(", ") : `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`;

  async function pasar() {
    setPasando(true);
    try {
      for (const p of pendientes) await cambiarUnidad(p.ingrediente, "ud", p.peso);
      for (const clave of [claves.ingredientes, claves.productos, claves.lotes, claves.recetas, claves.lista]) {
        void queryClient.invalidateQueries({ queryKey: clave(hogar.id) });
      }
      toast.success(`${pendientes.length} ${pendientes.length === 1 ? "ingrediente pasa" : "ingredientes pasan"} a contarse por unidades`);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setPasando(false);
    }
  }

  return (
    <Tarjeta className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex gap-3">
        <Hash className="mt-0.5 size-5 shrink-0 text-primario" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Contar por unidades, sin pesar</p>
          <p className="text-sm text-suave">
            {resumen.charAt(0).toUpperCase() + resumen.slice(1)} se miden en gramos. Pásalos a unidades y se convierten recetas, despensa y lista (p.
            ej., {nombres[0]}: {pendientes[0].peso} g la pieza).
          </p>
        </div>
      </div>
      <Boton variante="secundario" onClick={pasar} disabled={pasando}>
        {pasando ? "Pasando…" : "Pasar a unidades"}
      </Boton>
    </Tarjeta>
  );
}
