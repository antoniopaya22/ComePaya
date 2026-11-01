import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { recargar } from "@/lib/actualizacion";
import { cn } from "@/lib/utils";

/** Distancia (px) que hay que tirar para recargar. */
const UMBRAL = 72;
const MAXIMO = 110;

/** ¿Hay algo desplazado por encima del dedo (una lista, una hoja abierta…)? Entonces el gesto es suyo. */
function gestoDeOtro(destino: EventTarget | null): boolean {
  for (let el = destino as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.matches("[role=dialog], [data-vaul-drawer], input, textarea, select")) return true;
    if (el.scrollTop > 0) return true;
  }
  return false;
}

/**
 * "Tirar hacia abajo para recargar" en el móvil. El navegador lo tiene desactivado
 * (overscroll-behavior: none, para que la app no rebote como una web), así que se hace aquí.
 */
export function TirarParaRecargar() {
  const [distancia, setDistancia] = useState(0);
  const [recargando, setRecargando] = useState(false);
  const inicio = useRef<number | null>(null);
  const actual = useRef(0);

  useEffect(() => {
    function alTocar(e: TouchEvent) {
      if (recargando || window.scrollY > 0 || e.touches.length > 1 || gestoDeOtro(e.target)) return;
      inicio.current = e.touches[0].clientY;
    }
    function alMover(e: TouchEvent) {
      if (inicio.current === null) return;
      const tirado = e.touches[0].clientY - inicio.current;
      if (tirado <= 0 || window.scrollY > 0) {
        inicio.current = null;
        actual.current = 0;
        setDistancia(0);
        return;
      }
      // Resistencia: cuanto más se tira, menos avanza.
      actual.current = Math.min(MAXIMO, tirado * 0.5);
      setDistancia(actual.current);
    }
    async function alSoltar() {
      if (inicio.current === null) return;
      inicio.current = null;
      const suficiente = actual.current >= UMBRAL;
      actual.current = 0;
      if (!suficiente) return setDistancia(0);
      setRecargando(true);
      setDistancia(UMBRAL);
      navigator.vibrate?.(10);
      try {
        await recargar();
      } finally {
        setRecargando(false);
        setDistancia(0);
      }
    }
    window.addEventListener("touchstart", alTocar, { passive: true });
    window.addEventListener("touchmove", alMover, { passive: true });
    window.addEventListener("touchend", alSoltar);
    window.addEventListener("touchcancel", alSoltar);
    return () => {
      window.removeEventListener("touchstart", alTocar);
      window.removeEventListener("touchmove", alMover);
      window.removeEventListener("touchend", alSoltar);
      window.removeEventListener("touchcancel", alSoltar);
    };
  }, [recargando]);

  if (!distancia && !recargando) return null;
  const listo = distancia >= UMBRAL;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center md:top-16"
      style={{ transform: `translateY(${distancia - 44}px)`, transition: inicio.current === null ? "transform 200ms ease-out" : undefined }}
      role="status"
      aria-label={recargando ? "Recargando" : listo ? "Suelta para recargar" : "Tira para recargar"}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full border border-borde bg-superficie shadow-lg transition-colors",
          listo || recargando ? "text-primario" : "text-suave",
        )}
      >
        <RefreshCw className={cn("size-5", recargando && "animate-spin")} style={recargando ? undefined : { transform: `rotate(${distancia * 3}deg)` }} />
      </span>
    </div>
  );
}
