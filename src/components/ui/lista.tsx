import type { ComponentProps, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cn } from "@/lib/utils";

/**
 * Listas al estilo de las apps nativas: filas en un bloque redondeado con separadores finos,
 * en vez de una tarjeta con borde por elemento.
 */
export function Grupo({ titulo, extra, children, className }: { titulo?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      {(titulo || extra) && (
        <div className="flex items-baseline justify-between gap-2 px-4 md:px-1">
          {titulo && <h2 className="text-[13px] font-semibold tracking-wide text-suave uppercase">{titulo}</h2>}
          {extra && <span className="text-[13px] text-suave">{extra}</span>}
        </div>
      )}
      <div className="mx-4 overflow-hidden rounded-2xl bg-superficie shadow-[0_1px_2px_rgb(0_0_0/0.04)] md:mx-0 md:border md:border-borde [&>*+*]:border-t [&>*+*]:border-borde/70">
        {children}
      </div>
    </section>
  );
}

interface ContenidoFila {
  /** Icono, emoji o imagen a la izquierda (40 px). */
  inicio?: ReactNode;
  titulo: ReactNode;
  detalle?: ReactNode;
  /** Lo de la derecha: una etiqueta, una cantidad, un chevron… */
  fin?: ReactNode;
}

function Contenido({ inicio, titulo, detalle, fin }: ContenidoFila) {
  return (
    <>
      {inicio && <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-superficie-2 text-xl [&_svg]:size-5 [&_svg]:text-suave">{inicio}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] leading-snug">{titulo}</span>
        {detalle && <span className="block truncate text-[13.5px] leading-snug text-suave">{detalle}</span>}
      </span>
      {fin && <span className="flex shrink-0 items-center gap-1.5 text-[15px] text-suave">{fin}</span>}
    </>
  );
}

const claseFila = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left";

/** Fila estática (sin acción). */
export function Fila({ className, ...props }: ContenidoFila & { className?: string }) {
  return (
    <div className={cn(claseFila, className)}>
      <Contenido {...props} />
    </div>
  );
}

/** Fila que lleva a otra pantalla. */
export function FilaEnlace({ inicio, titulo, detalle, fin, className, ...props }: ContenidoFila & Omit<LinkProps, "title">) {
  return (
    <Link className={cn(claseFila, "pulsable", className)} {...props}>
      <Contenido inicio={inicio} titulo={titulo} detalle={detalle} fin={fin} />
    </Link>
  );
}

/** Fila que hace algo al pulsarla (abre una hoja, cambia un valor…). */
export function FilaBoton({ inicio, titulo, detalle, fin, className, ...props }: ContenidoFila & Omit<ComponentProps<"button">, "title">) {
  return (
    <button type="button" className={cn(claseFila, "pulsable", className)} {...props}>
      <Contenido inicio={inicio} titulo={titulo} detalle={detalle} fin={fin} />
    </button>
  );
}
