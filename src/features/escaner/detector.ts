// Detector de códigos de barras: API nativa de Chrome en Android; zxing en WebAssembly donde no existe (Safari/iOS).

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

export interface Detector {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

export type MotorDetector = "nativo" | "webassembly";

interface BarcodeDetectorNativo {
  new (opciones: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

export async function crearDetector(): Promise<{ detector: Detector; motor: MotorDetector }> {
  const Nativo = (globalThis as { BarcodeDetector?: BarcodeDetectorNativo }).BarcodeDetector;
  if (Nativo) {
    try {
      const soportados = await Nativo.getSupportedFormats();
      const formatos = FORMATOS.filter((f) => soportados.includes(f));
      if (formatos.length) return { detector: new Nativo({ formats: formatos }), motor: "nativo" };
    } catch {
      // Algunos Chrome de escritorio exponen la API sin implementación: se cae a WebAssembly.
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasm }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  // El motor se sirve desde la propia app (y queda en la caché sin conexión), no desde el CDN que usa por defecto.
  prepareZXingModule({ overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith(".wasm") ? wasm : prefijo + ruta) } });
  return { detector: new BarcodeDetector({ formats: [...FORMATOS] }), motor: "webassembly" };
}

/** Pitido corto de confirmación. El AudioContext debe crearse tras un toque del usuario. */
export function crearPitido() {
  const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audio = new Contexto();
  return () => {
    const oscilador = audio.createOscillator();
    const volumen = audio.createGain();
    oscilador.type = "sine";
    oscilador.frequency.value = 1320;
    volumen.gain.setValueAtTime(0.0001, audio.currentTime);
    volumen.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
    oscilador.connect(volumen).connect(audio.destination);
    oscilador.start();
    oscilador.stop(audio.currentTime + 0.13);
  };
}
