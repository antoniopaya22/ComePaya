import { useRef, useState } from "react";

interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type ConstructorReconocimiento = new () => Reconocimiento;

const Reconocedor = ((globalThis as { SpeechRecognition?: ConstructorReconocimiento }).SpeechRecognition ??
  (globalThis as { webkitSpeechRecognition?: ConstructorReconocimiento }).webkitSpeechRecognition) as ConstructorReconocimiento | undefined;

/** Dictado por voz (Web Speech API; Chrome en Android lo tiene). Llama a `alTerminar` con lo reconocido. */
export function useDictado(alTerminar: (texto: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actual = useRef<Reconocimiento | null>(null);

  function empezar() {
    if (!Reconocedor) return;
    setError(null);
    const r = new Reconocedor();
    r.lang = "es-ES";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const texto = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (texto) alTerminar(texto);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Sin permiso para usar el micrófono" : e.error === "no-speech" ? "No se ha oído nada" : "No se ha podido escuchar");
    r.onend = () => setEscuchando(false);
    actual.current = r;
    setEscuchando(true);
    r.start();
  }

  function parar() {
    actual.current?.stop();
  }

  return { disponible: Boolean(Reconocedor), escuchando, error, empezar, parar };
}
