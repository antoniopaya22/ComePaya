import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CloudOff, ListChecks, Mic, Pencil, Plus, Refrigerator, Share2, Store } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada, Selector } from "@/components/ui/campos";
import { Cabecera, ListaEsqueleto, Vacio } from "@/components/ui/varios";
import { emojiPara } from "@/dominio/ingredientes-base";
import { agruparPorSeccion, dividirDictado, textoParaCompartir } from "@/dominio/lista";
import { supabase } from "@/lib/supabase";
import { useTiempoReal } from "@/lib/tiempo-real";
import type { ItemLista } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, guardarTiendaActiva, leerTiendaActiva, useIngredientes, useLista, useLotes, useRecetas, useTiendas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { EditarItemHoja } from "./EditarItemHoja";
import { describirGeneracion, generarListaDesdeMenu } from "./generar";
import { GuardarCompraHoja } from "./GuardarCompraHoja";
import { Habituales } from "./Habituales";
import { useDictado } from "./useDictado";
import { AMBITO_LISTA, CLAVE_ALTERNAR, useEnLinea } from "./sin-conexion";
import { useAnadirALista } from "./useAnadirALista";

export function ListaPage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const clave = claves.lista(hogar.id);
  const { data: items, isPending } = useLista();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: tiendas = [] } = useTiendas();
  const { data: recetas = [] } = useRecetas();
  const { data: lotes = [] } = useLotes();
  useTiempoReal("item_lista", hogar.id, clave);

  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<ItemLista | null>(null);
  const [guardandoCompra, setGuardandoCompra] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [tiendaId, setTiendaId] = useState(() => leerTiendaActiva(hogar.id));
  const entrada = useRef<HTMLInputElement>(null);

  const tienda = tiendas.find((t) => t.id === tiendaId) ?? tiendas[0];
  const grupos = useMemo(() => agruparPorSeccion(items ?? [], tienda?.orden_secciones ?? []), [items, tienda]);
  const emojiDe = useMemo(() => new Map(ingredientes.map((i) => [i.id, i.emoji])), [ingredientes]);
  const marcados = (items ?? []).filter((i) => i.marcado);
  const pendientes = (items?.length ?? 0) - marcados.length;

  const enLinea = useEnLinea();
  const sinEnviar = useMutationState({ filters: { mutationKey: ["lista"], status: "pending" } }).length;

  // Marcar y añadir son optimistas y funcionan sin conexión: en el súper no se puede esperar a la red.
  const alternar = useMutation<void, Error, { id: string; marcado: boolean }, { anterior?: ItemLista[] }>({
    mutationKey: CLAVE_ALTERNAR,
    scope: AMBITO_LISTA,
    onMutate: async ({ id, marcado }) => {
      await queryClient.cancelQueries({ queryKey: clave });
      const anterior = queryClient.getQueryData<ItemLista[]>(clave);
      queryClient.setQueryData<ItemLista[]>(clave, (lista) => lista?.map((i) => (i.id === id ? { ...i, marcado } : i)));
      navigator.vibrate?.(15);
      return { anterior };
    },
    onError: (error, _vars, contexto) => {
      queryClient.setQueryData(clave, contexto?.anterior);
      toast.error(mensajeError(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });

  const anadirTexto = useAnadirALista();

  function anadir(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    anadirTexto(texto);
    setTexto("");
    entrada.current?.focus();
  }

  /** Dictado: "leche, dos kilos de tomates y pan" son tres entradas. */
  const dictado = useDictado((frase) => {
    const partes = dividirDictado(frase);
    partes.forEach(anadirTexto);
    toast.success(partes.length === 1 ? `Añadido: ${partes[0]}` : `${partes.length} añadidos`);
  });

  async function compartir() {
    const texto = textoParaCompartir(grupos);
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        toast.success("Lista copiada");
      }
    } catch {
      // Se cerró el diálogo de compartir.
    }
  }

  async function borrar(item: ItemLista) {
    const { error } = await supabase.from("item_lista").delete().eq("id", item.id);
    if (error) return toast.error(mensajeError(error));
    queryClient.invalidateQueries({ queryKey: clave });
    toast(`${item.texto} quitado`, {
      action: {
        label: "Deshacer",
        onClick: async () => {
          await supabase.from("item_lista").insert(item);
          queryClient.invalidateQueries({ queryKey: clave });
        },
      },
    });
  }


  async function desdeElMenu() {
    setGenerando(true);
    try {
      const resultado = await generarListaDesdeMenu({ hogarId: hogar.id, dias: 7, ingredientes, recetas, lotes });
      await queryClient.invalidateQueries({ queryKey: clave });
      toast.success(describirGeneracion(resultado), { description: "Con el menú de los próximos 7 días y lo que hay en casa." });
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <Cabecera
        titulo="Lista de la compra"
        subtitulo={items ? (pendientes ? `${pendientes} por comprar` : "Todo comprado") : undefined}
        accion={
          <div className="flex items-center gap-1">
          {(items?.length ?? 0) > 0 && (
            <Boton variante="fantasma" tamano="icono-sm" aria-label="Compartir la lista" title="Compartir (WhatsApp…)" onClick={compartir}>
              <Share2 />
            </Boton>
          )}
          {tiendas.length > 1 && (
            <label className="flex items-center gap-1.5 text-suave">
              <Store className="size-4" />
              <Selector
                aria-label="Tienda"
                className="h-9 w-auto border-transparent bg-superficie-2 pr-1 text-sm"
                value={tienda?.id}
                onChange={(e) => {
                  setTiendaId(e.target.value);
                  guardarTiendaActiva(hogar.id, e.target.value);
                }}
              >
                {tiendas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Selector>
            </label>
          )}
          </div>
        }
      />

      <div className="flex flex-col gap-5 px-4 md:px-0">
        {(!enLinea || sinEnviar > 0) && (
          <p className="flex items-center gap-2 rounded-xl bg-aviso-suave px-3 py-2 text-sm text-aviso">
            <CloudOff className="size-4 shrink-0" />
            {enLinea ? `Enviando ${sinEnviar} cambios…` : `Sin conexión. ${sinEnviar ? `${sinEnviar} cambios se enviarán al volver la red.` : "Puedes seguir marcando y añadiendo."}`}
          </p>
        )}
        <form onSubmit={anadir} className="sticky top-0 z-10 -mx-4 flex gap-2 bg-fondo/90 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
          <Entrada ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Añadir… (p. ej. 2 kg tomates)" enterKeyHint="done" />
          {dictado.disponible && (
            <Boton
              type="button"
              variante={dictado.escuchando ? "peligro" : "secundario"}
              tamano="icono"
              aria-label={dictado.escuchando ? "Dejar de escuchar" : "Dictar por voz"}
              onClick={dictado.escuchando ? dictado.parar : dictado.empezar}
              className={cn(dictado.escuchando && "animate-pulse")}
            >
              <Mic />
            </Boton>
          )}
          <Boton type="submit" tamano="icono" aria-label="Añadir" disabled={!texto.trim()}>
            <Plus />
          </Boton>
        </form>
        {dictado.error && <p className="-mt-3 text-sm text-peligro">{dictado.error}</p>}

        <Habituales items={items ?? []} onAnadir={anadirTexto} />

        <Boton variante="secundario" onClick={desdeElMenu} disabled={generando} className="-mt-2 self-start">
          <CalendarDays /> {generando ? "Calculando…" : "Completar desde el menú"}
        </Boton>

        {isPending ? (
          <ListaEsqueleto filas={6} />
        ) : !items?.length ? (
          <Vacio icono={<ListChecks />} titulo="Nada que comprar">
            Escribe arriba lo que falta. Se ordena solo por secciones del súper, en el orden de tu tienda.
          </Vacio>
        ) : (
          <div className="flex flex-col gap-5">
            {grupos.map((grupo) => (
              <section key={grupo.seccion}>
                <h2 className="mb-1.5 flex items-center justify-between px-1 text-xs font-semibold tracking-wide text-suave uppercase">
                  {grupo.seccion}
                  <span className="font-medium normal-case">{grupo.pendientes || "✓"}</span>
                </h2>
                <ul className="overflow-hidden rounded-2xl border border-borde bg-superficie">
                  <AnimatePresence initial={false}>
                    {grupo.items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout="position"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="touch-pan-y border-b border-borde bg-superficie last:border-b-0"
                        // Deslizar hacia la izquierda quita el elemento (con deshacer).
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0.6, right: 0 }}
                        dragSnapToOrigin
                        onDragEnd={(_e, info) => {
                          if (info.offset.x < -110) borrar(item);
                        }}
                      >
                        <div className="flex items-center">
                          <button
                            onClick={() => alternar.mutate({ id: item.id, marcado: !item.marcado })}
                            className="flex min-h-13 flex-1 items-center gap-3 py-2 pl-3.5 text-left"
                            aria-pressed={item.marcado}
                          >
                            <span
                              className={cn(
                                "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                                item.marcado ? "border-primario bg-primario text-primario-texto" : "border-borde",
                              )}
                            >
                              {item.marcado && <Check className="size-3.5" strokeWidth={3} />}
                            </span>
                            <span className={cn("text-xl leading-none transition-opacity", item.marcado && "opacity-40 grayscale")} aria-hidden>
                              {emojiPara(item.texto, item.seccion_super, item.ingrediente_id ? emojiDe.get(item.ingrediente_id) : null)}
                            </span>
                            <span className={cn("flex-1 transition-colors", item.marcado && "text-suave line-through")}>
                              {item.texto}
                              {item.origen !== "manual" && (
                                <span className="ml-2 rounded-full bg-primario-suave px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primario no-underline">
                                  {item.origen === "menu" ? "MENÚ" : "MÍNIMO"}
                                </span>
                              )}
                            </span>
                            {item.cantidad && <span className="text-sm text-suave">{item.cantidad}</span>}
                          </button>
                          <button onClick={() => setEditando(item)} className="h-13 px-3.5 text-xs text-suave" aria-label={`Editar ${item.texto}`}>
                            <Pencil className="size-4" />
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}

            {pendientes === 0 && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="flex flex-col items-center gap-1 rounded-3xl bg-primario-suave px-6 py-5 text-center"
              >
                <motion.span className="text-4xl" animate={{ rotate: [0, -12, 12, -6, 0] }} transition={{ delay: 0.2, duration: 0.6 }}>
                  🎉
                </motion.span>
                <p className="font-titulo text-xl font-semibold text-primario">¡Todo comprado!</p>
                <p className="text-sm text-suave">Guarda la compra para que pase a la despensa.</p>
              </motion.div>
            )}
            {marcados.length > 0 && (
              <Boton onClick={() => setGuardandoCompra(true)} className="self-center">
                <Refrigerator /> Guardar compra ({marcados.length})
              </Boton>
            )}
          </div>
        )}
      </div>

      <EditarItemHoja item={editando} onCerrar={() => setEditando(null)} ordenSecciones={tienda?.orden_secciones ?? []} />
      <GuardarCompraHoja items={marcados} abierta={guardandoCompra} onCerrar={() => setGuardandoCompra(false)} />
    </>
  );
}
