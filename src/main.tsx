import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import { ConfirmarProvider } from "./components/ui/confirmar";
import { registrarMutacionesLista } from "./features/lista/sin-conexion";
import { persister, queryClient } from "./lib/cache";
import { instalarCapturaDeErrores } from "./lib/errores";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./index.css";

registrarMutacionesLista(queryClient);
instalarCapturaDeErrores();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: "1" }}
      // Al abrir, se envían los cambios hechos sin conexión y después se refresca todo.
      onSuccess={() => queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())}
    >
      <ConfirmarProvider>
        <App />
      </ConfirmarProvider>
      <Toaster position="top-center" richColors closeButton={false} toastOptions={{ className: "!rounded-2xl" }} />
    </PersistQueryClientProvider>
  </StrictMode>,
);
