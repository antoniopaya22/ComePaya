import { useQuery } from "@tanstack/react-query";
import { sumarDias, hoyISO } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { habituales } from "@/dominio/lista";
import { supabase } from "@/lib/supabase";
import type { ItemLista } from "@/lib/tipos";
import { useIngredientes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";

/** Lo que más compráis y no está en la lista, para añadirlo con un toque. */
export function Habituales({ items, onAnadir }: { items: ItemLista[]; onAnadir: (texto: string) => void }) {
  const { hogar } = useHogar();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: compras = [] } = useQuery({
    queryKey: ["compras", hogar.id],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimiento_despensa")
        .select("producto:producto(ingrediente_id)")
        .eq("hogar_id", hogar.id)
        .eq("tipo", "alta")
        .gte("creado_en", sumarDias(hoyISO(), -90))
        .limit(500);
      if (error) throw error;
      return (data as unknown as { producto: { ingrediente_id: string } | null }[]).flatMap((m) => (m.producto ? [m.producto.ingrediente_id] : []));
    },
  });

  const pendientes = new Set(items.filter((i) => !i.marcado && i.ingrediente_id).map((i) => i.ingrediente_id!));
  const ids = habituales(compras, pendientes);
  const propuestas = ids.flatMap((id) => ingredientes.filter((i) => i.id === id));
  if (!propuestas.length) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Habituales">
      {propuestas.map((i) => (
        <button
          key={i.id}
          onClick={() => onAnadir(i.nombre)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-superficie px-3 text-sm font-medium active:scale-95"
        >
          <span>{emojiPara(i.nombre, i.seccion_super, i.emoji)}</span> {i.nombre}
        </button>
      ))}
    </div>
  );
}
