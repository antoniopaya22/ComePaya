import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Valoración de 1 a 5. Con `onChange` es editable; pulsar la estrella actual la quita. */
export function Estrellas({ valor, onChange, tamano = "sm" }: { valor: number | null; onChange?: (v: number | null) => void; tamano?: "sm" | "lg" }) {
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : "img"} aria-label={valor ? `${valor} de 5` : "Sin valorar"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const llena = valor !== null && n <= valor;
        const icono = <Star className={cn(tamano === "lg" ? "size-7" : "size-3.5", llena ? "fill-amber-400 text-amber-400" : "text-borde")} />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} estrellas`} onClick={() => onChange(valor === n ? null : n)} className="p-0.5 active:scale-90">
            {icono}
          </button>
        ) : (
          <span key={n}>{icono}</span>
        );
      })}
    </div>
  );
}
