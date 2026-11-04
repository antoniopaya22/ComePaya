import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CloudOff, ListChecks, Mic, Pencil, Plus, Refrigerator, Share2, Store, Trash2 } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { BarraApp, BotonBarra } from "@/components/BarraApp";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";
import { ErrorCarga, ListaEsqueleto, Vacio } from "@/components/ui/varios";
import { emojiPara } from "@/dominio/ingredientes-base";
import { agruparPorSeccion, deLaTienda, dividirDictado, textoParaCompartir } from "@/dominio/lista";
import { supabase } from "@/lib/supabase";
import type { ItemLista } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, guardarTiendaActiva, leerTiendaActiva, useIngredientes, useLista, useLotes, useRecetas, useTiendas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { EditarItemHoja } from "./EditarItemHoja";
import { avisarGeneracion, generarListaDesdeMenu } from "./generar";
import { GuardarCompraHoja } from "./GuardarCompraHoja";
import { Habituales } from "./Habituales";
import { useDictado } from "./useDictado";
import { AMBITO_LISTA, CLAVE_ALTERNAR, useEnLinea } from "./sin-conexion";
import { useAnadirALista } from "./useAnadirALista";

export function ListaPage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const clave = claves.lista(hogar.id);
  const { data: items, isPending, error: errorCarga, refetch: recargar } = useLista();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: tiendas = [] } = useTiendas();
  const { data: recetas = [] } = useRecetas();
  const { data: lotes = [] } = useLotes();

  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<ItemLista | null>(null);
  const [guardandoCompra, setGuardandoCompra] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [tiendaId, setTiendaId] = useState(() => leerTiendaActiva(hogar.id));
  const entrada = useRef<HTMLInputElement>(null);

  // Súper elegido: se ve lo suyo y lo de cualquiera, en el orden de sus pasillos. Sin elegir ("Todos"), todo.
  const elegida = tiendas.find((t) => t.id === tiendaId) ?? null;
  const visibles = useMemo(() => deLaTienda(items ?? [], elegida?.id ?? null), [items, elegida]);
  const tienda = elegida ?? tiendas[0];
  const grupos = useMemo(() => agruparPorSeccion(visibles, tienda?.orden_secciones ?? []), [visibles, tienda]);
  const nombreTienda = useMemo(() => new Map(tiendas.map((t) => [t.id, t.nombre])), [tiendas]);
  const emojiDe = useMemo(() => new Map(ingredientes.map((i) => [i.id, i.emoji])), [ingredientes]);
  const marcados = visibles.filter((i) => i.marcado);
  const pendientes = visibles.length - marcados.length;
  const pendientesDe = (id: string | null) => deLaTienda(items ?? [], id).filter((i) => !i.marcado).length;
  function elegirTienda(id: string | null) {
    setTiendaId(id);
    guardarTiendaActiva(hogar.id, id ?? "");
  }

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
    // Con el campo vacío, el botón lleva al campo (no se queda gris sin explicar por qué).
    if (!texto.trim()) return entrada.current?.focus();
    anadirTexto(texto, elegida?.id ?? null);
    setTexto("");
    entrada.current?.focus();
  }

  /** Dictado: "leche, dos kilos de tomates y pan" son tres entradas. */
  const dictado = useDictado((frase) => {
    const partes = dividirDictado(frase);
    partes.forEach((p) => anadirTexto(p, elegida?.id ?? null));
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
    void queryClient.invalidateQueries({ queryKey: clave });
    toast(`${item.texto} quitado`, {
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const { error } = await supabase.from("item_lista").insert(item);
          if (error) toast.error(mensajeError(error));
          void queryClient.invalidateQueries({ queryKey: clave });
        },
      },
    });
  }

  async function desdeElMenu() {
    setGenerando(true);
    try {
      const resultado = await generarListaDesdeMenu({ hogarId: hogar.id, dias: 7, ingredientes, recetas, lotes });
      const refrescar = () => queryClient.invalidateQueries({ queryKey: clave });
      await refrescar();
      avisarGeneracion(resultado, refrescar);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <BarraApp
        titulo="Lista de la compra"
        subtitulo={items ? (pendientes ? `${pendientes} por comprar` : "Todo comprado") : undefined}
        acciones={
          <>
            <BotonBarra
              etiqueta="Completar desde el menú"
              onClick={desdeElMenu}
              disabled={generando}
              className={cn("md:hidden", generando && "animate-pulse")}
            >
              <CalendarDays />
            </BotonBarra>
            {(items?.length ?? 0) > 0 && (
              <BotonBarra etiqueta="Compartir la lista" onClick={compartir}>
                <Share2 />
              </BotonBarra>
            )}
          </>
        }
        principal={
          <Boton variante="secundario" tamano="sm" onClick={desdeElMenu} disabled={generando}>
            <CalendarDays /> {generando ? "Calculando…" : "Completar desde el menú"}
          </Boton>
        }
      />

      <div className="flex flex-col gap-5 px-4 md:px-0">
        {tiendas.length > 0 && (
          <div className="-mx-4 -mt-1 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="radiogroup" aria-label="Súper">
            {[{ id: null, nombre: "Todos" }, ...tiendas].map((t) => {
              const activo = (elegida?.id ?? null) === t.id;
              return (
                <button
                  key={t.id ?? "todos"}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirTienda(t.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition-colors",
                    activo ? "bg-primario text-primario-texto" : "bg-superficie-2 text-texto",
                  )}
                >
                  {t.id ? <Store className="size-4" /> : null}
                  {t.nombre}
                  <span className={cn("text-sm", activo ? "opacity-80" : "text-suave")}>{pendientesDe(t.id)}</span>
                </button>
              );
            })}
            <Link to="/ajustes" className="flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[15px] font-medium text-primario">
              <Plus className="size-4" /> Súper
            </Link>
          </div>
        )}
        {(!enLinea || sinEnviar > 0) && (
          <p className="flex items-center gap-2 rounded-xl bg-aviso-suave px-3 py-2 text-sm text-aviso">
            <CloudOff className="size-4 shrink-0" />
            {enLinea
              ? `Enviando ${sinEnviar} cambios…`
              : `Sin conexión. ${sinEnviar ? `${sinEnviar} cambios se enviarán al volver la red.` : "Puedes seguir marcando y añadiendo."}`}
          </p>
        )}
        {/* Móvil: abajo, sobre la navegación, al alcance del pulgar. Escritorio: arriba. */}
        <form
          onSubmit={anadir}
          data-sobre-pestanas
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-20 flex items-center gap-2 border-t border-borde/70 bg-fondo/90 px-3 py-2 backdrop-blur-xl md:sticky md:top-16 md:bottom-auto md:z-10 md:border-0 md:px-0"
        >
          <Entrada
            ref={entrada}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Añadir… (p. ej. 2 kg tomates)"
            enterKeyHint="done"
            className="h-12 rounded-full bg-superficie px-5 md:h-11 md:rounded-xl md:px-3.5"
          />
          {dictado.disponible && (
            <Boton
              type="button"
              variante={dictado.escuchando ? "peligro" : "secundario"}
              tamano="icono"
              aria-label={dictado.escuchando ? "Dejar de escuchar" : "Dictar por voz"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={dictado.escuchando ? dictado.parar : dictado.empezar}
              className={cn("size-12 shrink-0 rounded-full md:size-11 md:rounded-xl", dictado.escuchando && "animate-pulse")}
            >
              <Mic />
            </Boton>
          )}
          {/* Sin quitar el foco al campo: el teclado sigue abierto para añadir otra cosa (y la barra no salta). */}
          <Boton type="submit" tamano="icono" aria-label="Añadir" onMouseDown={(e) => e.preventDefault()} className="size-12 shrink-0 rounded-full md:size-11 md:rounded-xl">
            <Plus />
          </Boton>
        </form>
        {dictado.error && <p className="text-sm text-peligro">{dictado.error}</p>}

        <Habituales items={items ?? []} onAnadir={(t) => anadirTexto(t, elegida?.id ?? null)} />

        {isPending ? (
          <ListaEsqueleto filas={6} />
        ) : errorCarga && !items ? (
          <ErrorCarga error={errorCarga} onReintentar={() => void recargar()} />
        ) : !visibles.length ? (
          <Vacio icono={<ListChecks />} titulo="Nada que comprar">
            Escribe lo que falta o complétala desde el menú. Se ordena sola por secciones del súper, en el orden de tu tienda.
            <Boton variante="secundario" className="mt-4 md:hidden" onClick={desdeElMenu} disabled={generando}>
              <CalendarDays /> {generando ? "Calculando…" : "Completar desde el menú"}
            </Boton>
          </Vacio>
        ) : (
          <div className="flex flex-col gap-5">
            {grupos.map((grupo) => (
              <section key={grupo.seccion}>
                <h2 className="mb-1.5 flex items-center justify-between px-1 text-[13px] font-semibold tracking-wide text-suave uppercase">
                  {grupo.seccion}
                  <span className="font-medium normal-case">{grupo.pendientes || "✓"}</span>
                </h2>
                <ul className="overflow-hidden rounded-2xl bg-superficie shadow-[0_1px_2px_rgb(0_0_0/0.04)] md:border md:border-borde">
                  <AnimatePresence initial={false}>
                    {grupo.items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout="position"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="relative overflow-hidden border-b border-borde/70 bg-peligro last:border-b-0"
                      >
                        {/* Detrás de la fila: lo que pasa al deslizar. */}
                        <span aria-hidden className="absolute inset-y-0 right-0 flex items-center pr-5 text-sobre-color">
                          <Trash2 className="size-5" />
                        </span>
                        <motion.div
                          className="relative flex touch-pan-y items-center bg-superficie"
                          // Deslizar hacia la izquierda quita el elemento (con deshacer).
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={{ left: 0.6, right: 0 }}
                          dragSnapToOrigin
                          onDragEnd={(_e, info) => {
                            if (info.offset.x < -110) void borrar(item);
                          }}
                        >
                          <button
                            onClick={() => alternar.mutate({ id: item.id, marcado: !item.marcado })}
                            className="flex min-h-14 flex-1 items-center gap-3 py-2 pl-4 text-left text-[16px]"
                            aria-pressed={item.marcado}
                          >
                            <span
                              className={cn(
                                "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                                item.marcado ? "border-primario bg-primario text-primario-texto" : "border-borde",
                              )}
                            >
                              {item.marcado && <Check className="size-4" strokeWidth={3} />}
                            </span>
                            <span className={cn("text-xl leading-none transition-opacity", item.marcado && "opacity-40 grayscale")} aria-hidden>
                              {emojiPara(item.texto, item.seccion_super, item.ingrediente_id ? emojiDe.get(item.ingrediente_id) : null)}
                            </span>
                            <span className={cn("flex-1 transition-colors", item.marcado && "text-suave line-through")}>
                              {item.texto}
                              {!elegida && item.tienda_id && nombreTienda.get(item.tienda_id) && (
                                <span className="ml-2 rounded-full bg-superficie-2 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-suave no-underline">
                                  {nombreTienda.get(item.tienda_id)!.toUpperCase()}
                                </span>
                              )}
                              {item.origen !== "manual" && (
                                <span className="ml-2 rounded-full bg-primario-suave px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primario no-underline">
                                  {item.origen === "menu" ? "MENÚ" : "MÍNIMO"}
                                </span>
                              )}
                            </span>
                            {item.cantidad && <span className="text-[15px] text-suave">{item.cantidad}</span>}
                          </button>
                          <button
                            onClick={() => setEditando(item)}
                            className="grid h-14 w-12 place-items-center text-suave active:bg-superficie-2"
                            aria-label={`Editar ${item.texto}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                        </motion.div>
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
              <Boton
                onClick={() => setGuardandoCompra(true)}
                tamano="lg"
                className="sticky bottom-[calc(env(safe-area-inset-bottom)+9rem)] z-10 self-center rounded-full shadow-lg md:static md:rounded-xl md:shadow-sm"
              >
                <Refrigerator /> Guardar compra ({marcados.length})
              </Boton>
            )}
          </div>
        )}
        {/* Hueco para que el campo de añadir no tape lo último de la lista. */}
        <div className="h-16 md:hidden" />
      </div>

      <EditarItemHoja item={editando} onCerrar={() => setEditando(null)} ordenSecciones={tienda?.orden_secciones ?? []} tiendas={tiendas} />
      <GuardarCompraHoja items={marcados} abierta={guardandoCompra} onCerrar={() => setGuardandoCompra(false)} />
    </>
  );
}
