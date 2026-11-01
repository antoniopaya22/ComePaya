import { useCallback, useEffect, useRef, useState } from "react";
import { eanValido } from "@/dominio/ean";
import { crearDetector, crearPitido, type Detector, type MotorDetector } from "./detector";

/** Tiempo durante el que se ignora el mismo código para no contarlo dos veces en una sola pasada. */
const ESPERA_MISMO_CODIGO_MS = 2500;

/** Cámara trasera + detección continua de EAN. Llama a `alDetectar` una vez por pasada de cada código. */
export function useCamara(alDetectar: (ean: string) => void) {
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);
  const detector = useRef<Detector | null>(null);
  const pitido = useRef<(() => void) | null>(null);
  // Último momento en que se vio cada código: la espera se aplica por código, no solo al último
  // (con dos códigos en el encuadre se alternarían y contarían como pasadas nuevas).
  const vistos = useRef(new Map<string, number>());
  const activo = useRef(false);
  const callback = useRef(alDetectar);
  callback.current = alDetectar;

  const [estado, setEstado] = useState<"parado" | "arrancando" | "escaneando" | "error">("parado");
  const [error, setError] = useState<string | null>(null);
  const [motor, setMotor] = useState<MotorDetector | null>(null);
  const [linterna, setLinterna] = useState<boolean | null>(null);

  const parar = useCallback(() => {
    activo.current = false;
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
    setLinterna(null);
    setEstado("parado");
  }, []);

  const detectado = useCallback((ean: string) => {
    const ahora = Date.now();
    const anterior = vistos.current.get(ean);
    vistos.current.set(ean, ahora);
    if (anterior !== undefined && ahora - anterior < ESPERA_MISMO_CODIGO_MS) return;
    pitido.current?.();
    navigator.vibrate?.(80);
    callback.current(ean);
  }, []);

  const bucle = useCallback(() => {
    const elemento = video.current;
    if (!activo.current || !elemento || !detector.current) return;
    const siguiente = () => {
      if (!activo.current) return;
      if ("requestVideoFrameCallback" in elemento) elemento.requestVideoFrameCallback(() => bucle());
      else setTimeout(bucle, 120);
    };
    if (elemento.readyState < 2) return siguiente();
    detector.current
      .detect(elemento)
      .then((codigos) => {
        const valido = codigos.map((c) => c.rawValue).find(eanValido);
        if (valido) detectado(valido);
      })
      .catch(() => {})
      .finally(siguiente);
  }, [detectado]);

  const arrancar = useCallback(async () => {
    setEstado("arrancando");
    setError(null);
    try {
      pitido.current ??= crearPitido();
      if (!detector.current) {
        const creado = await crearDetector();
        detector.current = creado.detector;
        setMotor(creado.motor);
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      flujo.current = stream;
      const pista = stream.getVideoTracks()[0];
      const capacidades = (pista.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
      if (capacidades.focusMode?.includes("continuous")) {
        await pista.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      }
      setLinterna(capacidades.torch ? false : null);
      const elemento = video.current!;
      elemento.srcObject = stream;
      await elemento.play();
      activo.current = true;
      setEstado("escaneando");
      bucle();
    } catch (e) {
      parar();
      setEstado("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "No hay permiso para usar la cámara. Actívalo en los ajustes del navegador para esta web."
          : e instanceof DOMException && e.name === "NotFoundError"
            ? "Este dispositivo no tiene cámara."
            : `No se ha podido abrir la cámara: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [bucle, parar]);

  const alternarLinterna = useCallback(async () => {
    const pista = flujo.current?.getVideoTracks()[0];
    if (!pista || linterna === null) return;
    await pista.applyConstraints({ advanced: [{ torch: !linterna } as MediaTrackConstraintSet] }).catch(() => {});
    setLinterna(!linterna);
  }, [linterna]);

  useEffect(() => parar, [parar]);

  return { video, estado, error, motor, linterna, arrancar, parar, alternarLinterna };
}
