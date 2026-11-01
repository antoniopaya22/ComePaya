import * as Primitivo from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Menú desplegable accesible (teclado, foco y cierre) con el estilo de la app. */
export const Menu = Primitivo.Root;
export const MenuDisparador = Primitivo.Trigger;

export function MenuContenido({ className, sideOffset = 8, align = "end", ...props }: ComponentProps<typeof Primitivo.Content>) {
  return (
    <Primitivo.Portal>
      <Primitivo.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          "z-50 min-w-56 overflow-hidden rounded-2xl border border-borde bg-superficie p-1.5 shadow-xl shadow-black/10",
          "origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-[aparecer_120ms_ease-out]",
          className,
        )}
        {...props}
      />
    </Primitivo.Portal>
  );
}

export function MenuOpcion({ className, peligro, ...props }: ComponentProps<typeof Primitivo.Item> & { peligro?: boolean }) {
  return (
    <Primitivo.Item
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm outline-none select-none data-[highlighted]:bg-superficie-2 [&_svg]:size-4 [&_svg]:shrink-0",
        peligro ? "text-peligro" : "[&_svg]:text-suave",
        className,
      )}
      {...props}
    />
  );
}

export function MenuEtiqueta({ className, ...props }: ComponentProps<typeof Primitivo.Label>) {
  return <Primitivo.Label className={cn("px-3 pt-2 pb-1 text-xs font-medium text-suave", className)} {...props} />;
}

export function MenuSeparador({ className, ...props }: ComponentProps<typeof Primitivo.Separator>) {
  return <Primitivo.Separator className={cn("-mx-1.5 my-1.5 h-px bg-borde", className)} {...props} />;
}
