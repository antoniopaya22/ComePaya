import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Panel inferior que se arrastra con el dedo (bottom sheet). En escritorio se centra con ancho máximo.
 * Con `modal={false}` no oscurece ni bloquea lo de detrás: lo usa el escáner para que la cámara siga activa (§7.2).
 */
export function Hoja({
  abierta,
  onAbiertaChange,
  titulo,
  descripcion,
  children,
  pie,
  modal = true,
}: {
  abierta: boolean;
  onAbiertaChange: (abierta: boolean) => void;
  titulo: ReactNode;
  descripcion?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  modal?: boolean;
}) {
  return (
    <Drawer.Root open={abierta} onOpenChange={onAbiertaChange} modal={modal} repositionInputs={false}>
      <Drawer.Portal>
        {modal && <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />}
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-borde bg-superficie outline-none",
            !modal && "shadow-[0_-8px_30px_rgba(0,0,0,0.25)]",
          )}
        >
          <Drawer.Handle className="mt-3 mb-1 !h-1.5 !w-10 !bg-borde" />
          <div className="px-5 pt-2 pb-3">
            <Drawer.Title className="text-lg font-semibold">{titulo}</Drawer.Title>
            {descripcion ? (
              <Drawer.Description className="text-sm text-suave">{descripcion}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{titulo}</Drawer.Description>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {pie && <div className="pb-seguro border-t border-borde px-5 pt-3 pb-4">{pie}</div>}
          {!pie && <div className="pb-seguro" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
