import { BellOff, ChevronLeft, ChevronRight, Plus, Timer, X } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Boton } from "@/components/ui/boton";
import { useConfirmar } from "@/components/ui/confirmar";
import { Cargando } from "@/components/ui/varios";
import { escalar } from "@/dominio/menu";
import { formatearTemporizador, segundosRestantes } from "@/dominio/recordatorios";
import { formatearCantidad } from "@/dominio/unidades";
import { cn } from "@/lib/utils";
import { useRecetas } from "../datos";
import { crearPitido } from "../escaner/detector";

interface Temporizador {
  id: number;
  nombre: string;
  fin: number;
  sonando: boolean;
}

/**
 * Modo cocina (§4.5): la pantalla no se apaga, texto grande, un paso cada vez y avance con un toque.
 * Los temporizadores se lanzan desde los pasos y pueden ir varios a la vez.
 */
export function ModoCocinaPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const confirmar = useConfirmar();
  const { data: recetas, isPending } = useRecetas();
  const receta = recetas?.find((r) => r.id === id);
  const raciones = Number(params.get("raciones")) || receta?.raciones || 1;
  // Si se llega desde una comida del menú, al terminar se va a esa comida para apuntarla como cocinada.
  const franja = params.get("franja");

  const [paso, setPaso] = useState(0);
  const [temporizadores, setTemporizadores] = useState<Temporizador[]>([]);
  const [ahora, setAhora] = useState(Date.now());
  const pitido = useRef<(() => void) | null>(null);
  useWakeLock();

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(intervalo);
  }, []);

  // Cuando un temporizador llega a cero: suena, vibra y avisa (también con la pantalla en otra app).
  useEffect(() => {
    const terminados = temporizadores.filter((t) => !t.sonando && t.fin <= ahora);
    if (!terminados.length) return;
    setTemporizadores((lista) => lista.map((t) => (terminados.some((x) => x.id === t.id) ? { ...t, sonando: true } : t)));
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    for (const t of terminados) avisar(`${t.nombre}: ¡tiempo!`);
  }, [ahora, temporizadores]);

  const sonando = temporizadores.some((t) => t.sonando);
  useEffect(() => {
    if (!sonando) return;
    const intervalo = setInterval(() => {
      pitido.current?.();
      setTimeout(() => pitido.current?.(), 180);
    }, 1200);
    return () => clearInterval(intervalo);
  }, [sonando]);

  if (isPending) return <Cargando className="min-h-dvh" />;
  if (!receta) return null;

  const total = receta.pasos.length + 1;
  const actual = paso === 0 ? null : receta.pasos[paso - 1];

  function lanzar(nombre: string, segundos: number) {
    pitido.current ??= crearPitido();
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    setTemporizadores((lista) => [...lista, { id: Date.now(), nombre, fin: Date.now() + segundos * 1000, sonando: false }]);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-fondo">
      <header className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <Boton
          variante="fantasma"
          tamano="icono"
          aria-label="Salir del modo cocina"
          onClick={async () => {
            const activos = temporizadores.filter((t) => !t.sonando).length;
            if (activos && !(await confirmar({ titulo: "¿Salir del modo cocina?", mensaje: `Hay ${activos === 1 ? "un temporizador en marcha" : `${activos} temporizadores en marcha`} y se perderán.`, aceptar: "Salir" })))
              return;
            navigate(`/recetas/${receta.id}`);
          }}
        >
          <X />
        </Boton>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{receta.nombre}</p>
          <p className="text-xs text-suave">
            {paso === 0 ? "Ingredientes" : `Paso ${paso} de ${total - 1}`} · {raciones} raciones
          </p>
        </div>
      </header>
      <div className="mx-4 h-1 overflow-hidden rounded-full bg-superficie-2">
        <motion.div className="h-full bg-primario" animate={{ width: `${((paso + 1) / total) * 100}%` }} />
      </div>

      {temporizadores.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          {temporizadores.map((t) => {
            const restante = segundosRestantes(t.fin, ahora);
            return (
              <div
                key={t.id}
                className={cn("flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2", t.sonando ? "animate-pulse bg-peligro text-sobre-color" : "bg-primario-suave text-primario")}
              >
                <Timer className="size-4" />
                <span className="text-sm font-medium">{t.nombre}</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{formatearTemporizador(restante)}</span>
                {!t.sonando && (
                  <button aria-label={`Sumar un minuto a ${t.nombre}`} className="-my-2 grid size-11 place-items-center rounded-full active:bg-black/10" onClick={() => setTemporizadores((l) => l.map((x) => (x.id === t.id ? { ...x, fin: x.fin + 60_000 } : x)))}>
                    <Plus className="size-5" />
                  </button>
                )}
                <button aria-label={t.sonando ? `Silenciar ${t.nombre}` : `Quitar ${t.nombre}`} className="-my-2 -mr-2 grid size-11 place-items-center rounded-full active:bg-black/10" onClick={() => setTemporizadores((l) => l.filter((x) => x.id !== t.id))}>
                  {t.sonando ? <BellOff className="size-5" /> : <X className="size-5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <main className="relative flex flex-1 flex-col overflow-y-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={paso} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.18 }} className="pointer-events-none flex flex-1 flex-col gap-6">
            {actual ? (
              <>
                <p className="text-[26px] leading-snug font-medium md:text-4xl">{actual.texto}</p>
                {actual.temporizador_seg && (
                  <Boton tamano="lg" className="pointer-events-auto relative z-10 self-start" onClick={() => lanzar(actual.temporizador_nombre || `Paso ${paso}`, actual.temporizador_seg!)}>
                    <Timer /> {actual.temporizador_nombre || "Temporizador"} · {formatearTemporizador(actual.temporizador_seg)}
                  </Boton>
                )}
              </>
            ) : (
              <ul className="flex flex-col gap-3 text-xl">
                {receta.ingredientes.map((ri) => (
                  <li key={ri.id} className="flex justify-between gap-4 border-b border-borde pb-3">
                    <span>
                      {ri.ingrediente.nombre}
                      {ri.opcional && <span className="text-base text-suave"> (opcional)</span>}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {formatearCantidad(Math.round(escalar(ri.cantidad, receta.raciones, raciones) * 10) / 10, ri.ingrediente.unidad_base)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
        {/* Zonas táctiles: un toque a la derecha avanza y a la izquierda retrocede. */}
        <button aria-label="Paso anterior" className="absolute inset-y-0 left-0 w-1/4" onClick={() => setPaso(Math.max(0, paso - 1))} />
        <button aria-label="Paso siguiente" className="absolute inset-y-0 right-0 w-1/2" onClick={() => setPaso(Math.min(total - 1, paso + 1))} />
      </main>

      <footer className="grid grid-cols-2 gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Boton variante="secundario" tamano="lg" onClick={() => setPaso(paso - 1)} disabled={paso === 0}>
          <ChevronLeft /> Anterior
        </Boton>
        {paso < total - 1 ? (
          <Boton tamano="lg" onClick={() => setPaso(paso + 1)}>
            Siguiente <ChevronRight />
          </Boton>
        ) : (
          <Boton tamano="lg" onClick={() => navigate(franja ? `/menu?franja=${franja}` : `/recetas/${receta.id}`)}>
            {franja ? "Terminar y apuntar" : "Terminar"}
          </Boton>
        )}
      </footer>
    </div>
  );
}

/** Mantiene la pantalla encendida mientras la página está visible (Wake Lock API). */
function useWakeLock() {
  useEffect(() => {
    let bloqueo: WakeLockSentinel | null = null;
    const pedir = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) bloqueo = await navigator.wakeLock.request("screen");
      } catch {
        // Sin batería suficiente o sin soporte: se sigue sin bloqueo.
      }
    };
    void pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      void bloqueo?.release();
    };
  }, []);
}

async function avisar(texto: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registro = await navigator.serviceWorker?.ready.catch(() => null);
  if (registro) await registro.showNotification(texto, { icon: "/pwa-192x192.png", tag: "temporizador", lang: "es" });
}
