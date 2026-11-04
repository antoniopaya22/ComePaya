import { X } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { LogoMarca } from "@/components/Logo";
import { cn } from "@/lib/utils";

interface PasoRecorrido {
  /** Valor de `data-recorrido` del elemento a señalar; sin él, la tarjeta sale centrada. */
  objetivo?: string;
  titulo: string;
  texto: string;
}

// Los objetivos existen a la vez en la versión móvil y en la de escritorio; se señala el que se ve.
const PASOS: PasoRecorrido[] = [
  { titulo: "Bienvenido a ComePayá", texto: "Te enseño lo importante en medio minuto. Puedes saltarlo cuando quieras." },
  {
    objetivo: "navegacion",
    titulo: "Todo a mano",
    texto: "Hoy, Menú, Lista, Despensa y Recetas. Los números te dicen qué falta por comprar y qué caduca pronto.",
  },
  {
    objetivo: "buscar",
    titulo: "Busca lo que sea",
    texto: "Recetas, productos o ingredientes. Si algo no está, pulsa Intro y va directo a la lista de la compra.",
  },
  {
    objetivo: "escanear",
    titulo: "Escanea la compra",
    texto: "Apunta al código de barras y pon la caducidad: así sabes lo que hay en casa sin escribir nada.",
  },
  { objetivo: "avisos", titulo: "Lo que caduca", texto: "La campana te dice qué hay que gastar primero para no tirar comida." },
  {
    objetivo: "hogar",
    titulo: "Tu hogar, en familia",
    texto: "En Ajustes tienes el código para que los tuyos se unan a tu hogar y veáis la misma despensa, lista y menú.",
  },
  { titulo: "¡Listo!", texto: "En Hoy tienes los primeros pasos para empezar. Puedes volver a ver este recorrido desde tu cuenta." },
];

const EVENTO = "comepaya:recorrido";
const CLAVE_VISTO = "comepaya.recorrido-visto";
const MARGEN = 16;
const HUECO = 6;

/** Vuelve a mostrar el recorrido desde cualquier parte de la app. */
export function iniciarRecorrido() {
  window.dispatchEvent(new Event(EVENTO));
}

function yaVisto(): boolean {
  try {
    return localStorage.getItem(CLAVE_VISTO) === "1";
  } catch {
    return true;
  }
}

function marcarVisto() {
  try {
    localStorage.setItem(CLAVE_VISTO, "1");
  } catch {
    // Sin almacenamiento se volvería a mostrar; no es grave.
  }
}

/** El elemento visible con ese `data-recorrido` (hay uno para móvil y otro para escritorio). */
function buscarObjetivo(objetivo?: string): DOMRect | null {
  if (!objetivo) return null;
  const elementos = document.querySelectorAll<HTMLElement>(`[data-recorrido="${objetivo}"]`);
  for (const el of elementos) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

/** Recorrido guiado por la interfaz: se muestra la primera vez que se entra y cuando se pide. */
export function Recorrido() {
  const [paso, setPaso] = useState<number | null>(null);
  const { pathname } = useLocation();
  const iniciado = useRef(false);

  // La primera vez, al llegar a Hoy, con un momento para que se pinte la pantalla.
  useEffect(() => {
    if (iniciado.current || pathname !== "/" || yaVisto()) return;
    const t = setTimeout(() => {
      iniciado.current = true;
      setPaso(0);
    }, 700);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const abrir = () => setPaso(0);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  const terminar = useCallback(() => {
    marcarVisto();
    setPaso(null);
  }, []);

  return createPortal(
    <AnimatePresence>{paso !== null && <Capa key="recorrido" paso={paso} onPaso={setPaso} onTerminar={terminar} />}</AnimatePresence>,
    document.body,
  );
}

function Capa({ paso, onPaso, onTerminar }: { paso: number; onPaso: (n: number) => void; onTerminar: () => void }) {
  const actual = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vista, setVista] = useState({ ancho: window.innerWidth, alto: window.innerHeight });
  const siguiente = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const medir = () => {
      setRect(buscarObjetivo(actual.objetivo));
      setVista({ ancho: window.innerWidth, alto: window.innerHeight });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [actual.objetivo]);

  useEffect(() => siguiente.current?.focus(), [paso]);

  const avanzar = useCallback(() => (ultimo ? onTerminar() : onPaso(paso + 1)), [ultimo, onTerminar, onPaso, paso]);

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") onTerminar();
      else if (e.key === "ArrowRight") avanzar();
      else if (e.key === "ArrowLeft" && paso > 0) onPaso(paso - 1);
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [avanzar, onTerminar, onPaso, paso]);

  // Dónde va la tarjeta: a la derecha de la barra lateral, encima de la barra inferior o debajo de lo demás.
  const ancho = Math.min(340, vista.ancho - MARGEN * 2);
  let posicion: CSSProperties;
  if (!rect) {
    posicion = { left: (vista.ancho - ancho) / 2, top: "50%", translate: "0 -50%" };
  } else if (vista.ancho >= 768 && rect.right < vista.ancho * 0.3) {
    posicion = { left: rect.right + HUECO + 14, top: Math.max(MARGEN, Math.min(rect.top, vista.alto - 260)) };
  } else {
    const left = Math.max(MARGEN, Math.min(rect.left + rect.width / 2 - ancho / 2, vista.ancho - ancho - MARGEN));
    posicion = rect.top + rect.height / 2 > vista.alto / 2 ? { left, bottom: vista.alto - rect.top + HUECO + 12 } : { left, top: rect.bottom + HUECO + 12 };
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorrido-titulo"
      aria-describedby="recorrido-texto"
    >
      {/* Oscurece todo salvo el hueco del elemento señalado. */}
      <motion.div
        className="pointer-events-none absolute rounded-2xl"
        style={{ boxShadow: "0 0 0 9999px rgb(10 16 13 / 0.6)" }}
        initial={false}
        animate={
          rect
            ? { left: rect.left - HUECO, top: rect.top - HUECO, width: rect.width + HUECO * 2, height: rect.height + HUECO * 2, opacity: 1 }
            : { left: vista.ancho / 2, top: vista.alto / 2, width: 0, height: 0, opacity: 1 }
        }
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      />
      {rect && (
        <motion.div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white/80"
          initial={false}
          animate={{ left: rect.left - HUECO, top: rect.top - HUECO, width: rect.width + HUECO * 2, height: rect.height + HUECO * 2 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        />
      )}

      <motion.div
        key={paso}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="absolute rounded-3xl border border-borde bg-superficie p-5 shadow-2xl shadow-black/30"
        style={{ width: ancho, ...posicion }}
      >
        <div className="flex items-start gap-3">
          {!actual.objetivo && <LogoMarca className="size-10 shrink-0 rounded-xl" />}
          <div className="min-w-0 flex-1">
            <h2 id="recorrido-titulo" className="font-titulo text-xl leading-tight font-semibold">
              {actual.titulo}
            </h2>
          </div>
          <button onClick={onTerminar} aria-label="Cerrar el recorrido" className="-my-2 -mr-3 grid size-11 shrink-0 place-items-center rounded-full text-suave hover:bg-superficie-2">
            <X className="size-4" />
          </button>
        </div>
        <p id="recorrido-texto" className="mt-2 text-[15px] leading-relaxed text-suave">
          {actual.texto}
        </p>

        <div className="mt-5 flex items-center gap-2">
          <div className="flex flex-1 gap-1.5" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
            {PASOS.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all", i === paso ? "w-5 bg-primario" : "w-1.5 bg-borde")} />
            ))}
          </div>
          {paso > 0 && !ultimo && (
            <button onClick={() => onPaso(paso - 1)} className="h-10 rounded-xl px-3 text-sm font-medium text-suave hover:bg-superficie-2">
              Atrás
            </button>
          )}
          {paso === 0 && (
            <button onClick={onTerminar} className="h-10 rounded-xl px-3 text-sm font-medium text-suave hover:bg-superficie-2">
              Saltar
            </button>
          )}
          <button
            ref={siguiente}
            onClick={avanzar}
            className="h-10 rounded-xl bg-primario px-4 text-sm font-semibold text-primario-texto shadow-sm transition-colors hover:bg-primario-hover"
          >
            {paso === 0 ? "Empezar" : ultimo ? "Terminar" : "Siguiente"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
