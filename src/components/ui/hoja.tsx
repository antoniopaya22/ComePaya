import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useConfirmar } from "./confirmar";

/**
 * Panel inferior que se arrastra con el dedo (bottom sheet). En escritorio se centra con ancho máximo.
 * Con `modal={false}` no oscurece ni bloquea lo de detrás: lo usa el escáner para que la cámara siga activa (§7.2).
 * Con `sucio` (hay cambios sin guardar) no se cierra al deslizar ni al tocar fuera: aparece «Descartar», que pregunta.
 */
export function Hoja({
  abierta,
  onAbiertaChange,
  titulo,
  descripcion,
  children,
  pie,
  modal = true,
  sucio = false,
}: {
  abierta: boolean;
  onAbiertaChange: (abierta: boolean) => void;
  titulo: ReactNode;
  descripcion?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  modal?: boolean;
  sucio?: boolean;
}) {
  const confirmar = useConfirmar();

  async function descartar() {
    const ok = await confirmar({ titulo: "¿Descartar los cambios?", mensaje: "Lo que has cambiado aquí no se guardará.", aceptar: "Descartar", peligro: true });
    if (ok) onAbiertaChange(false);
  }

  return (
    <Drawer.Root open={abierta} onOpenChange={onAbiertaChange} modal={modal} dismissible={!sucio} repositionInputs={false}>
      <Drawer.Portal>
        {modal && <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />}
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-borde bg-superficie outline-none",
            !modal && "shadow-[0_-8px_30px_rgba(0,0,0,0.25)]",
          )}
        >
          <Drawer.Handle className="mt-3 mb-1 !h-1.5 !w-10 !bg-borde" />
          <div className="flex items-start gap-3 px-5 pt-2 pb-3">
            <div className="min-w-0 flex-1">
              <Drawer.Title className="text-lg font-semibold">{titulo}</Drawer.Title>
              {descripcion ? (
                <Drawer.Description className="text-sm text-suave">{descripcion}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{titulo}</Drawer.Description>
              )}
            </div>
            {sucio ? (
              <button type="button" onClick={descartar} className="-my-2 h-11 shrink-0 px-1 text-[15px] font-medium text-suave">
                Descartar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAbiertaChange(false)}
                aria-label="Cerrar"
                className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-suave active:bg-superficie-2"
              >
                <span className="grid size-8 place-items-center rounded-full bg-superficie-2">
                  <X className="size-4" />
                </span>
              </button>
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

/**
 * Si `valores` ha cambiado desde que se abrió el formulario. La foto de partida se toma justo después de abrir,
 * cuando el formulario ya ha cargado sus datos.
 */
export function useCambiosSinGuardar(abierto: boolean, valores: unknown): boolean {
  const actual = JSON.stringify(valores);
  const ultimo = useRef(actual);
  ultimo.current = actual;
  const [inicial, setInicial] = useState<string | null>(null);
  useEffect(() => {
    if (!abierto) return setInicial(null);
    const t = setTimeout(() => setInicial(ultimo.current), 0);
    return () => clearTimeout(t);
  }, [abierto]);
  return abierto && inicial !== null && inicial !== actual;
}
