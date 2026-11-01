import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tarjeta({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-borde bg-superficie", className)} {...props} />;
}

const tonos = {
  neutro: "bg-superficie-2 text-suave",
  primario: "bg-primario-suave text-primario",
  aviso: "bg-aviso-suave text-aviso",
  peligro: "bg-peligro-suave text-peligro",
} as const;

export function Etiqueta({ tono = "neutro", className, ...props }: ComponentProps<"span"> & { tono?: keyof typeof tonos }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tonos[tono], className)}
      {...props}
    />
  );
}

export function Cargando({ texto = "Cargando…", className }: { texto?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-12 text-suave", className)}>
      <LoaderCircle className="size-5 animate-spin" />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

export function Vacio({ icono, titulo, children }: { icono: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-primario-suave text-primario [&_svg]:size-8">{icono}</div>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {children && <div className="max-w-xs text-sm text-suave">{children}</div>}
    </div>
  );
}

export function Cabecera({ titulo, subtitulo, accion }: { titulo: string; subtitulo?: ReactNode; accion?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-6 pb-4 md:px-0 md:pt-10">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-suave">{subtitulo}</p>}
      </div>
      {accion}
    </header>
  );
}
