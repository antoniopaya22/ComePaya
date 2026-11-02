import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tarjeta({ className, ...props }: ComponentProps<"div">) {
  // En el móvil, sin borde: superficie sobre el fondo, como las tarjetas nativas.
  return <div className={cn("rounded-2xl bg-superficie shadow-[0_1px_2px_rgb(0_0_0/0.04)] md:border md:border-borde", className)} {...props} />;
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

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-superficie-2", className)} />;
}

/** Marcador de carga con la forma de una lista de tarjetas. */
export function ListaEsqueleto({ filas = 5 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3" style={{ opacity: 1 - i * 0.12 }}>
          <Esqueleto className="size-12 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Esqueleto className="h-3.5 w-2/3" />
            <Esqueleto className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Vacio({ icono, titulo, children }: { icono: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 rotate-6 rounded-[28px] bg-primario-suave" />
        <span className="absolute inset-1 -rotate-3 rounded-3xl border border-primario/20 bg-superficie" />
        <span className="relative text-primario [&_svg]:size-8">{icono}</span>
      </div>
      <h2 className="font-titulo text-xl font-semibold">{titulo}</h2>
      {children && <div className="max-w-xs text-sm text-suave">{children}</div>}
    </div>
  );
}

