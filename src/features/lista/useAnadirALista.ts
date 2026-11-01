import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { buscarIngrediente, parsearEntrada, SECCION_OTROS } from "@/dominio/lista";
import type { ItemLista } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useIngredientes } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { AMBITO_LISTA, CLAVE_ANADIR, type FilaNueva } from "./sin-conexion";

/**
 * Añade "2 kg de tomates" a la lista: reconoce el ingrediente y su sección, se ve al momento
 * y, sin conexión, se queda en cola hasta que vuelva la red. Devuelve el nombre con el que se ha añadido.
 */
export function useAnadirALista() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const clave = claves.lista(hogar.id);
  const { data: ingredientes = [] } = useIngredientes();

  const anadirFila = useMutation<void, Error, FilaNueva>({
    mutationKey: CLAVE_ANADIR,
    scope: AMBITO_LISTA,
    onMutate: async (fila) => {
      await queryClient.cancelQueries({ queryKey: clave });
      queryClient.setQueryData<ItemLista[]>(clave, (lista) => [
        ...(lista ?? []),
        { ...fila, cantidad_base: null, marcado: false, origen: "manual" },
      ]);
    },
    onError: (error) => toast.error(mensajeError(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });

  return function anadirTexto(entradaTexto: string): string | null {
    const { texto: nombre, cantidad } = parsearEntrada(entradaTexto);
    if (!nombre) return null;
    const ingrediente = buscarIngrediente(nombre, ingredientes);
    const texto = ingrediente?.nombre ?? nombre;
    anadirFila.mutate({
      id: crypto.randomUUID(),
      hogar_id: hogar.id,
      texto,
      cantidad,
      ingrediente_id: ingrediente?.id ?? null,
      seccion_super: ingrediente?.seccion_super ?? SECCION_OTROS,
      creado_en: new Date().toISOString(),
    });
    return texto;
  };
}
