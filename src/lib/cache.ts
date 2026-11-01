import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime largo: lo cacheado se guarda en el dispositivo para abrir la app sin conexión (§4.2).
    queries: { staleTime: 30_000, gcTime: 7 * 24 * 60 * 60 * 1000, retry: 1 },
  },
});

export const persister = createSyncStoragePersister({ storage: window.localStorage, key: "despensa.cache" });

/** Al cerrar sesión no deben quedar en el dispositivo datos del hogar ni cambios pendientes de otra cuenta. */
export function vaciarCache() {
  queryClient.cancelQueries();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  persister.removeClient();
  try {
    localStorage.removeItem("despensa.hogar-activo");
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}
