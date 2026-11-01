import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import { registrarMutacionesLista } from "./features/lista/sin-conexion";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime largo: lo cacheado se guarda en el dispositivo para abrir la app sin conexión (§4.2).
    queries: { staleTime: 30_000, gcTime: 7 * 24 * 60 * 60 * 1000, retry: 1 },
  },
});
registrarMutacionesLista(queryClient);

const persister = createSyncStoragePersister({ storage: window.localStorage, key: "despensa.cache" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: "1" }}
      // Al abrir, se envían los cambios hechos sin conexión y después se refresca todo.
      onSuccess={() => queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())}
    >
      <App />
      <Toaster position="top-center" richColors closeButton={false} toastOptions={{ className: "!rounded-2xl" }} />
    </PersistQueryClientProvider>
  </StrictMode>,
);
