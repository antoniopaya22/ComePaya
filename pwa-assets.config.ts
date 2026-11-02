import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Android (maskable) e iOS (apple) recortan el icono a su forma: tiene que llegar al borde, sin el margen blanco
// que pone el preset. El dibujo de favicon.svg ya cabe en la zona segura (círculo del 80 %) sin reducirlo.
const aSangre = { padding: 0, resizeOptions: { background: "#2f6b4f" } };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...aSangre },
    apple: { ...minimal2023Preset.apple, ...aSangre },
  },
  images: ["public/favicon.svg"],
});
