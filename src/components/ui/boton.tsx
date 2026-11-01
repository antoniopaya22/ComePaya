import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variantes = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[background-color,transform,opacity] select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        primario: "bg-primario text-primario-texto hover:bg-primario-hover shadow-sm",
        secundario: "bg-superficie-2 text-texto hover:bg-borde",
        contorno: "border border-borde bg-superficie text-texto hover:bg-superficie-2",
        fantasma: "text-texto hover:bg-superficie-2",
        peligro: "bg-peligro-suave text-peligro hover:brightness-95",
      },
      tamano: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[15px]",
        lg: "h-13 px-5 text-base",
        icono: "size-11",
        "icono-sm": "size-9",
      },
    },
    defaultVariants: { variante: "primario", tamano: "md" },
  },
);

export interface BotonProps extends ComponentProps<"button">, VariantProps<typeof variantes> {
  asChild?: boolean;
}

export function Boton({ className, variante, tamano, asChild, ...props }: BotonProps) {
  const Componente = asChild ? Slot : "button";
  return <Componente className={cn(variantes({ variante, tamano }), className)} {...props} />;
}
