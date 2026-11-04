import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { LazyMotion } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import { ConfirmarProvider } from "./components/ui/confirmar";
import { registrarMutacionesLista } from "./features/lista/sin-conexion";
import { persister, queryClient } from "./lib/cache";
import { vigilarActualizaciones } from "./lib/actualizacion";
import { instalarCapturaDeErrores } from "./lib/errores";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./index.css";

// Las animaciones arrancan sin su motor completo; llega en un archivo aparte justo después.
const funcionesAnimacion = () => import("./lib/animaciones").then((m) => m.default);

registrarMutacionesLista(queryClient);
instalarCapturaDeErrores();
vigilarActualizaciones();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: "1" }}
      // Al abrir, se envían los cambios hechos sin conexión y después se refresca todo.
      onSuccess={() => queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())}
    >
      <LazyMotion features={funcionesAnimacion} strict>
        <ConfirmarProvider>
          <App />
        </ConfirmarProvider>
      </LazyMotion>
      <Toaster
        position="bottom-center"
        mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
        richColors
        closeButton={false}
        toastOptions={{ className: "!rounded-2xl" }}
      />
    </PersistQueryClientProvider>
  </StrictMode>,
);
