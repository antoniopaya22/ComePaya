import { TriangleAlert } from "lucide-react";
import { ALERGENOS, conflictos, etiquetaAlergeno } from "@/dominio/alergenos";
import { cn } from "@/lib/utils";
import { useHogar } from "../hogar/HogarProvider";

/** Etiquetas de alérgenos; los que afectan al hogar, en rojo y con aviso. */
export function ChipsAlergenos({ alergenos, opcionales = [], vacio }: { alergenos: string[]; opcionales?: string[]; vacio?: string }) {
  const { hogar } = useHogar();
  const delHogar = hogar.alergenos ?? [];
  const peligro = conflictos([...alergenos, ...opcionales], delHogar);
  if (!alergenos.length && !opcionales.length) return vacio ? <p className="text-sm text-suave">{vacio}</p> : null;
  const chip = (a: string, opcional = false) => (
    <span
      key={a}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        delHogar.includes(a) ? "bg-peligro text-white" : "bg-superficie-2 text-texto",
        opcional && "border border-dashed border-borde",
      )}
    >
      {ALERGENOS.find((x) => x.valor === a)?.emoji} {etiquetaAlergeno(a)}
      {opcional && " (opcional)"}
    </span>
  );
  return (
    <div className="flex flex-col gap-2">
      {peligro.length > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-peligro-suave px-3 py-2 text-sm font-medium text-peligro">
          <TriangleAlert className="size-4 shrink-0" /> Contiene {peligro.map(etiquetaAlergeno).join(", ").toLowerCase()}, que os afecta
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {alergenos.map((a) => chip(a))}
        {opcionales.map((a) => chip(a, true))}
      </div>
    </div>
  );
}

/** Selector de los 14 alérgenos oficiales. */
export function SelectorAlergenos({ valor, onChange, desactivado }: { valor: string[]; onChange: (v: string[]) => void; desactivado?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALERGENOS.map((a) => {
        const activo = valor.includes(a.valor);
        return (
          <button
            key={a.valor}
            type="button"
            disabled={desactivado}
            aria-pressed={activo}
            onClick={() => onChange(activo ? valor.filter((v) => v !== a.valor) : [...valor, a.valor])}
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm transition-colors disabled:opacity-50",
              activo ? "border-primario bg-primario text-primario-texto" : "border-borde bg-superficie",
            )}
          >
            {a.emoji} {a.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
