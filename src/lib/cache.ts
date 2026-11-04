import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";

export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime largo: lo cacheado se guarda en el dispositivo para abrir la app sin conexión (§4.2).
    // staleTime de minutos: los cambios de otros miembros llegan por tiempo real (useSincronizacionHogar),
    // así que no hace falta volver a pedirlo todo cada vez que se cambia de pantalla o de app.
    queries: { staleTime: 5 * 60_000, gcTime: 7 * 24 * 60 * 60 * 1000, retry: 1 },
  },
});

const CLAVE = "despensa.cache";

/**
 * La caché vive en IndexedDB: no tiene el límite de ~5 MB de localStorage ni bloquea al leerla.
 * Si IndexedDB no está disponible (algunos modos privados), se usa localStorage.
 * La primera vez se recupera la caché antigua de localStorage, con los cambios sin enviar que tuviera.
 */
const almacen = {
  async getItem(clave: string): Promise<string | null> {
    try {
      const guardado = await get<string>(clave);
      if (guardado != null) return guardado;
      const antiguo = localStorage.getItem(clave);
      if (antiguo != null) {
        await set(clave, antiguo);
        localStorage.removeItem(clave);
      }
      return antiguo;
    } catch {
      return localStorage.getItem(clave);
    }
  },
  async setItem(clave: string, valor: string) {
    try {
      await set(clave, valor);
    } catch {
      localStorage.setItem(clave, valor);
    }
  },
  async removeItem(clave: string) {
    await del(clave).catch(() => {});
    localStorage.removeItem(clave);
  },
};

export const persister = createAsyncStoragePersister({ storage: almacen, key: CLAVE, throttleTime: 1000 });

/** Al cerrar sesión no deben quedar en el dispositivo datos del hogar ni cambios pendientes de otra cuenta. */
export function vaciarCache() {
  void queryClient.cancelQueries();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  void persister.removeClient();
  try {
    localStorage.removeItem("despensa.hogar-activo");
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}
