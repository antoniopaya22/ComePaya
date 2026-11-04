import { Minus, Plus } from "lucide-react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const baseCampo =
  "w-full rounded-xl border border-borde bg-superficie px-3.5 text-[16px] text-texto placeholder:text-suave/85 outline-none transition-colors focus:border-primario focus:ring-3 focus:ring-primario/15";

export function Entrada({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(baseCampo, "h-11", className)} {...props} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(baseCampo, "min-h-20 py-2.5 leading-snug", className)} {...props} />;
}

export function Selector({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(baseCampo, "h-11 pr-2", className)} {...props} />;
}

export function Campo({ etiqueta, ayuda, children, className }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- solo evita el clic implícito del label; el teclado va a los controles.
    <label
      className={cn("flex flex-col gap-1.5", className)}
      onClick={(e) => {
        // Un <label> activa su primer control: con un contador o unas opciones dentro, eso era pulsar "−" o elegir la primera.
        const fuera = !(e.target as Element).closest("button, input, select, textarea, a");
        if (fuera && e.currentTarget.control instanceof HTMLButtonElement) e.preventDefault();
      }}
    >
      <span className="text-sm font-medium text-suave">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-suave">{ayuda}</span>}
    </label>
  );
}

/** Selector de cantidad con botones grandes, pensado para el pulgar. */
export function Contador({
  valor,
  onChange,
  min = 0,
  paso = 1,
  sufijo,
  etiqueta,
}: {
  /** Qué se cuenta, para los lectores de pantalla ("Menos raciones"); dentro de un Campo ya lo da la etiqueta. */
  etiqueta?: string;
  valor: number;
  onChange: (valor: number) => void;
  min?: number;
  paso?: number;
  sufijo?: ReactNode;
}) {
  // Se escribe como texto ("1,5" o vacío mientras se borra) y solo se avisa de números válidos.
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => {
    setTexto((t) => (Number(t.replace(",", ".")) === valor ? t : String(valor)));
  }, [valor]);

  return (
    <div className="flex h-12 items-center gap-1 rounded-xl border border-borde bg-superficie p-0.5 focus-within:border-primario focus-within:ring-3 focus-within:ring-primario/15">
      <button
        type="button"
        aria-label={etiqueta ? `Menos ${etiqueta}` : "Menos"}
        className="grid size-11 place-items-center rounded-lg bg-superficie-2 active:scale-95 disabled:opacity-40"
        disabled={valor - paso < min}
        onClick={() => onChange(Math.max(min, +(valor - paso).toFixed(2)))}
      >
        <Minus className="size-4" />
      </button>
      <div className="flex flex-1 items-baseline justify-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={etiqueta ?? "Cantidad"}
          className="w-14 bg-transparent text-center text-lg font-semibold outline-none"
          value={texto}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const limpio = e.target.value.replace(/[^\d.,]/g, "");
            setTexto(limpio);
            const n = Number(limpio.replace(",", "."));
            if (limpio !== "" && Number.isFinite(n)) onChange(Math.max(min, n));
          }}
          onBlur={() => setTexto(String(valor))}
        />
        {sufijo && <span className="self-center text-sm whitespace-nowrap text-suave">{sufijo}</span>}
      </div>
      <button
        type="button"
        aria-label={etiqueta ? `Más ${etiqueta}` : "Más"}
        className="grid size-11 place-items-center rounded-lg bg-superficie-2 active:scale-95"
        onClick={() => onChange(+(valor + paso).toFixed(2))}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Grupo de opciones excluyentes con aspecto de pastillas. */
export function Opciones<T extends string>({
  opciones,
  valor,
  onChange,
  className,
}: {
  opciones: { valor: T; etiqueta: ReactNode }[];
  valor: T | null;
  onChange: (valor: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "h-10 rounded-full border px-4 text-sm font-medium transition-colors active:scale-95",
            valor === o.valor
              ? "border-primario bg-primario text-primario-texto"
              : "border-borde bg-superficie text-texto hover:bg-superficie-2",
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

export function Interruptor({ marcado, onChange, etiqueta, ayuda }: { marcado: boolean; onChange: (v: boolean) => void; etiqueta: string; ayuda?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={marcado}
      onClick={() => onChange(!marcado)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-borde bg-superficie px-3.5 py-3 text-left"
    >
      <span>
        <span className="block text-[15px] font-medium">{etiqueta}</span>
        {ayuda && <span className="block text-xs text-suave">{ayuda}</span>}
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", marcado ? "bg-primario" : "bg-borde-control")}>
        <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-[left]", marcado ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}
