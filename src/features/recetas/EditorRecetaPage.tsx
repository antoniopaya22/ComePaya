import { useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, LoaderCircle, Plus, Timer, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { BarraApp, BotonBarra } from "@/components/BarraApp";
import { Boton } from "@/components/ui/boton";
import { useConfirmar } from "@/components/ui/confirmar";
import { AreaTexto, Campo, Contador, Entrada, Opciones } from "@/components/ui/campos";
import { Estrellas } from "@/components/ui/estrellas";
import { Cargando, Tarjeta } from "@/components/ui/varios";
import { parsearLineaIngrediente } from "@/dominio/importar";
import { subirFoto } from "@/lib/fotos";
import { buscarIngrediente } from "@/dominio/lista";
import { normalizar } from "@/dominio/texto";
import { formatearCantidad, MEDIDAS_CASERAS, medidaABase, type MedidaCasera, type UnidadBase } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { RecetaCompleta } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, useIngredientes, useRecetas } from "../datos";
import { obtenerOCrearIngrediente } from "../despensa/altas";
import { useHogar } from "../hogar/HogarProvider";
import type { RecetaImportada } from "./ImportarRecetaHoja";

interface FilaIngrediente {
  clave: string;
  nombre: string;
  cantidad: string;
  opcional: boolean;
  unidadNueva: UnidadBase;
  /** Texto de la web al importar, para revisar las cantidades aproximadas. */
  original?: string;
  revisar?: boolean;
  /** "base" (g, ml, ud) o una medida casera que se convierte al guardar. */
  medida?: "base" | MedidaCasera;
}

interface FilaPaso {
  clave: string;
  texto: string;
  minutos: string;
  nombreTemporizador: string;
}

let contador = 0;
const nuevaClave = () => `fila-${++contador}`;
const filaIngredienteVacia = (): FilaIngrediente => ({ clave: nuevaClave(), nombre: "", cantidad: "", opcional: false, unidadNueva: "g" });
const filaPasoVacia = (): FilaPaso => ({ clave: nuevaClave(), texto: "", minutos: "", nombreTemporizador: "" });
const numero = (texto: string) => Number(texto.replace(",", "."));

export function EditorRecetaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hogar } = useHogar();
  const confirmar = useConfirmar();
  const { data: recetas, isPending } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const original = id ? recetas?.find((r) => r.id === id) : undefined;

  const [nombre, setNombre] = useState("");
  const [raciones, setRaciones] = useState(hogar.comensales ?? 2);
  const [prep, setPrep] = useState("");
  const [coccion, setCoccion] = useState("");
  const [previa, setPrevia] = useState("");
  const [previaHoras, setPreviaHoras] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [valoracion, setValoracion] = useState<number | null>(null);
  const [notas, setNotas] = useState("");
  const [filas, setFilas] = useState<FilaIngrediente[]>([filaIngredienteVacia()]);
  const [pasos, setPasos] = useState<FilaPaso[]>([filaPasoVacia()]);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fuenteUrl, setFuenteUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [cargada, setCargada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const importada = (useLocation().state as RecetaImportada | null) ?? null;

  useEffect(() => {
    if (original && !cargada) {
      cargar(original);
      setCargada(true);
    } else if (!id && importada && !cargada) {
      cargarImportada(importada);
      setCargada(true);
    }
  }, [original, cargada]);

  function cargarImportada({ receta, url }: RecetaImportada) {
    setNombre(receta.nombre);
    if (receta.raciones) setRaciones(receta.raciones);
    setPrep(receta.tiempo_prep_min?.toString() ?? "");
    setCoccion(receta.tiempo_coccion_min?.toString() ?? "");
    setFotoUrl(receta.imagen);
    setFuenteUrl(url);
    setNotas(`Importada de ${url}`);
    const lineas = receta.ingredientes.map(parsearLineaIngrediente);
    setFilas(
      lineas.length
        ? lineas.map((l) => {
            const existente = buscarIngrediente(l.nombre, ingredientes);
            return {
              clave: nuevaClave(),
              nombre: existente?.nombre ?? l.nombre,
              cantidad: l.cantidad ? String(l.cantidad).replace(".", ",") : "",
              opcional: false,
              unidadNueva: l.unidad,
              original: l.original,
              // Revisar: medida casera aproximada, sin cantidad, o unidad distinta de la del ingrediente existente.
              revisar: l.aproximada || !l.cantidad || Boolean(existente && existente.unidad_base !== l.unidad),
            };
          })
        : [filaIngredienteVacia()],
    );
    setPasos(receta.pasos.length ? receta.pasos.map((texto) => ({ ...filaPasoVacia(), texto })) : [filaPasoVacia()]);
  }

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      setFotoUrl(await subirFoto(hogar.id, archivo));
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setSubiendo(false);
    }
  }

  function cargar(r: RecetaCompleta) {
    setNombre(r.nombre);
    setRaciones(r.raciones);
    setPrep(r.tiempo_prep_min?.toString() ?? "");
    setCoccion(r.tiempo_coccion_min?.toString() ?? "");
    setPrevia(r.preparacion_previa ?? "");
    setPreviaHoras(r.preparacion_previa_horas?.toString() ?? "");
    setEtiquetas(r.etiquetas.join(", "));
    setFotoUrl(r.foto_url);
    setFuenteUrl(r.fuente_url);
    setValoracion(r.valoracion);
    setNotas(r.notas ?? "");
    setFilas(
      r.ingredientes.length
        ? r.ingredientes.map((i) => ({
            clave: nuevaClave(),
            nombre: i.ingrediente.nombre,
            cantidad: String(i.cantidad).replace(".", ","),
            opcional: i.opcional,
            unidadNueva: i.ingrediente.unidad_base,
          }))
        : [filaIngredienteVacia()],
    );
    setPasos(
      r.pasos.length
        ? r.pasos.map((p) => ({
            clave: nuevaClave(),
            texto: p.texto,
            minutos: p.temporizador_seg ? String(Math.round(p.temporizador_seg / 60)) : "",
            nombreTemporizador: p.temporizador_nombre ?? "",
          }))
        : [filaPasoVacia()],
    );
  }

  const cambiarFila = (clave: string, cambio: Partial<FilaIngrediente>) => setFilas(filas.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));
  const cambiarPaso = (clave: string, cambio: Partial<FilaPaso>) => setPasos(pasos.map((p) => (p.clave === clave ? { ...p, ...cambio } : p)));

  const filasUsadas = filas.filter((f) => f.nombre.trim());
  /** Cantidad de una fila en la unidad base del ingrediente (convierte las medidas caseras). */
  function cantidadEnBase(f: FilaIngrediente): number | null {
    if (!f.medida || f.medida === "base") return null;
    const existente = buscarIngrediente(f.nombre, ingredientes);
    return medidaABase(numero(f.cantidad), f.medida, existente?.unidad_base ?? f.unidadNueva, existente?.equivalencias ?? null);
  }

  const errorCantidad = filasUsadas.some((f) => !(numero(f.cantidad) > 0));
  const valida = nombre.trim() && filasUsadas.length > 0 && !errorCantidad;

  async function guardar() {
    if (!valida) return;
    setGuardando(true);
    try {
      // Crea los ingredientes que aún no existen (una sola vez aunque se repitan en la receta).
      const creados = new Map<string, string>();
      const lineas = [];
      for (const f of filasUsadas) {
        let ingredienteId = creados.get(normalizar(f.nombre));
        if (!ingredienteId) {
          ingredienteId = await obtenerOCrearIngrediente(hogar.id, f.nombre, { unidad_base: f.unidadNueva }, ingredientes);
          creados.set(normalizar(f.nombre), ingredienteId);
        }
        lineas.push({ ingrediente_id: ingredienteId, cantidad: cantidadEnBase(f) ?? numero(f.cantidad), opcional: f.opcional });
      }

      const { data: recetaId, error } = await supabase.rpc("guardar_receta", {
        p_receta: {
          id: original?.id ?? "",
          hogar_id: hogar.id,
          nombre: nombre.trim(),
          raciones,
          tiempo_prep_min: prep ? Math.round(numero(prep)) : "",
          tiempo_coccion_min: coccion ? Math.round(numero(coccion)) : "",
          preparacion_previa: previa,
          preparacion_previa_horas: previa.trim() && previaHoras ? Math.round(numero(previaHoras)) : "",
          etiquetas: [
            ...new Set(
              etiquetas
                .split(",")
                .map((e) => e.trim().toLowerCase())
                .filter(Boolean),
            ),
          ],
          valoracion: valoracion ?? "",
          notas,
        },
        p_ingredientes: lineas,
        p_pasos: pasos
          .filter((p) => p.texto.trim())
          .map((p) => ({
            texto: p.texto,
            temporizador_seg: numero(p.minutos) > 0 ? Math.round(numero(p.minutos) * 60) : "",
            temporizador_nombre: p.nombreTemporizador,
          })),
      });
      if (error) throw error;
      const { error: errorFoto } = await supabase.from("receta").update({ foto_url: fotoUrl, fuente_url: fuenteUrl }).eq("id", recetaId);
      if (errorFoto) throw errorFoto;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: claves.recetas(hogar.id) }),
        queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) }),
      ]);
      toast.success("Receta guardada");
      navigate(`/recetas/${recetaId}`, { replace: true });
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!original) return;
    const seguro = await confirmar({
      titulo: `¿Borrar «${original.nombre}»?`,
      mensaje: "Las comidas del menú que la usan quedarán vacías.",
      aceptar: "Borrar",
      peligro: true,
    });
    if (!seguro) return;
    const { error } = await supabase.from("receta").delete().eq("id", original.id);
    if (error) return toast.error(mensajeError(error));
    await queryClient.invalidateQueries({ queryKey: claves.recetas(hogar.id) });
    queryClient.invalidateQueries({ queryKey: claves.franjas(hogar.id) });
    navigate("/recetas", { replace: true });
  }

  if (id && isPending) return <Cargando />;

  return (
    <>
      <BarraApp
        titulo={original ? "Editar receta" : "Nueva receta"}
        atras={original ? `/recetas/${original.id}` : "/recetas"}
        acciones={
          original && (
            <BotonBarra etiqueta="Borrar receta" onClick={borrar} className="text-peligro!">
              <Trash2 />
            </BotonBarra>
          )
        }
      />
      <div className="flex flex-col gap-6 px-4 md:px-0">
        <label className="relative block aspect-[16/9] cursor-pointer overflow-hidden rounded-3xl border border-dashed border-borde bg-superficie-2">
          {fotoUrl ? (
            <img src={fotoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-2 text-suave">
              <ImagePlus className="size-8" />
              <span className="text-sm font-medium">Añadir foto del plato</span>
            </span>
          )}
          {subiendo && (
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <LoaderCircle className="size-7 animate-spin" />
            </span>
          )}
          {fotoUrl && !subiendo && (
            <span className="absolute right-3 bottom-3 flex gap-2">
              <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">Cambiar</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setFotoUrl(null);
                }}
                className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white"
              >
                Quitar
              </button>
            </span>
          )}
          <input type="file" accept="image/*" hidden onChange={(e) => elegirFoto(e.target.files?.[0])} />
        </label>

        <Tarjeta className="flex flex-col gap-4 p-4">
          <Campo etiqueta="Nombre">
            <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Lentejas con chorizo" />
          </Campo>
          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3">
            <Campo etiqueta="Raciones">
              <Contador valor={raciones} onChange={(v) => setRaciones(Math.max(1, Math.round(v)))} min={1} />
            </Campo>
            <Campo etiqueta="Prep. (min)">
              <Entrada inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="15" className="h-12" />
            </Campo>
            <Campo etiqueta="Cocción (min)">
              <Entrada inputMode="numeric" value={coccion} onChange={(e) => setCoccion(e.target.value)} placeholder="40" className="h-12" />
            </Campo>
          </div>
          <Campo etiqueta="Valoración">
            <Estrellas valor={valoracion} onChange={setValoracion} tamano="lg" />
          </Campo>
          <Campo
            etiqueta="Etiquetas"
            ayuda={`Separadas por comas: legumbre, rápida, invierno…${hogar.bebe_nombre ? ` Con «bebé» sale en el menú de ${hogar.bebe_nombre}.` : ""}`}
          >
            <Entrada value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="legumbre, cuchara" />
          </Campo>
        </Tarjeta>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ingredientes</h2>
            <p className="text-sm text-suave">
              Cantidades para {raciones} {raciones === 1 ? "ración" : "raciones"}, en gramos, mililitros o unidades.
            </p>
          </div>
          <datalist id="receta-ingredientes">
            {ingredientes.map((i) => (
              <option key={i.id} value={i.nombre} />
            ))}
          </datalist>
          {filas.map((f) => {
            const existente = f.nombre.trim() ? buscarIngrediente(f.nombre, ingredientes) : null;
            const unidad = existente?.unidad_base ?? f.unidadNueva;
            const cantidadMal = f.nombre.trim() && !(numero(f.cantidad) > 0);
            return (
              <Tarjeta key={f.clave} className="flex flex-col gap-2 p-3">
                <div className="flex gap-2">
                  <Entrada
                    list="receta-ingredientes"
                    value={f.nombre}
                    onChange={(e) => cambiarFila(f.clave, { nombre: e.target.value })}
                    placeholder="Ingrediente"
                  />
                  <div className={cn("relative shrink-0", unidad === "ud" ? "w-28" : "w-36")}>
                    <Entrada
                      inputMode="decimal"
                      value={f.cantidad}
                      onChange={(e) => cambiarFila(f.clave, { cantidad: e.target.value })}
                      placeholder="0"
                      className={cn(unidad === "ud" ? "pr-9" : "pr-16", "text-right", cantidadMal && "border-peligro")}
                      aria-label="Cantidad"
                    />
                    {unidad === "ud" ? (
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-suave">{unidad}</span>
                    ) : (
                      <select
                        aria-label="Medida"
                        value={f.medida ?? "base"}
                        onChange={(e) => cambiarFila(f.clave, { medida: e.target.value as FilaIngrediente["medida"] })}
                        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md bg-transparent py-1 text-sm text-suave outline-none"
                      >
                        <option value="base">{unidad}</option>
                        {MEDIDAS_CASERAS.map((m) => (
                          <option key={m.valor} value={m.valor}>
                            {m.etiqueta}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <Boton
                    variante="fantasma"
                    tamano="icono"
                    aria-label="Quitar ingrediente"
                    onClick={() => setFilas(filas.length > 1 ? filas.filter((x) => x.clave !== f.clave) : [filaIngredienteVacia()])}
                  >
                    <X />
                  </Boton>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {f.nombre.trim() && !existente ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-suave">Nuevo, se mide en</span>
                      <Opciones
                        opciones={[
                          { valor: "g" as const, etiqueta: "g" },
                          { valor: "ml" as const, etiqueta: "ml" },
                          { valor: "ud" as const, etiqueta: "ud" },
                        ]}
                        valor={f.unidadNueva}
                        onChange={(u) => cambiarFila(f.clave, { unidadNueva: u })}
                        className="[&_button]:h-8 [&_button]:px-3"
                      />
                    </div>
                  ) : (
                    <span />
                  )}
                  <label className="flex items-center gap-2 text-sm text-suave">
                    <input
                      type="checkbox"
                      checked={f.opcional}
                      onChange={(e) => cambiarFila(f.clave, { opcional: e.target.checked })}
                      className="size-4 accent-[var(--primario)]"
                    />
                    Opcional
                  </label>
                </div>
                {f.medida && f.medida !== "base" && numero(f.cantidad) > 0 && unidad !== "ud" && (
                  <p className="text-xs text-suave">
                    ≈ {formatearCantidad(medidaABase(numero(f.cantidad), f.medida, unidad, existente?.equivalencias ?? null) ?? 0, unidad)}
                    {existente?.equivalencias?.[f.medida] ? "" : " (equivalencia estándar; ajústala en el ingrediente)"}
                  </p>
                )}
                {f.original && f.revisar && (
                  <p className="rounded-lg bg-aviso-suave px-2.5 py-1.5 text-xs text-aviso">Revisa la cantidad. En la web: «{f.original}»</p>
                )}
              </Tarjeta>
            );
          })}
          <Boton variante="secundario" onClick={() => setFilas([...filas, filaIngredienteVacia()])} className="self-start">
            <Plus /> Ingrediente
          </Boton>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Pasos</h2>
          {pasos.map((p, i) => (
            <Tarjeta key={p.clave} className="flex flex-col gap-2 p-3">
              <div className="flex gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primario text-sm font-semibold text-primario-texto">
                  {i + 1}
                </span>
                <AreaTexto
                  value={p.texto}
                  onChange={(e) => cambiarPaso(p.clave, { texto: e.target.value })}
                  placeholder="Describe el paso"
                  rows={2}
                />
                <Boton
                  variante="fantasma"
                  tamano="icono"
                  aria-label="Quitar paso"
                  onClick={() => setPasos(pasos.length > 1 ? pasos.filter((x) => x.clave !== p.clave) : [filaPasoVacia()])}
                >
                  <X />
                </Boton>
              </div>
              <div className="ml-9 flex items-center gap-2">
                <Timer className="size-4 shrink-0 text-suave" />
                <Entrada
                  inputMode="numeric"
                  value={p.minutos}
                  onChange={(e) => cambiarPaso(p.clave, { minutos: e.target.value })}
                  placeholder="min"
                  className="h-9 w-20"
                  aria-label="Minutos del temporizador"
                />
                <Entrada
                  value={p.nombreTemporizador}
                  onChange={(e) => cambiarPaso(p.clave, { nombreTemporizador: e.target.value })}
                  placeholder="Nombre del temporizador (opcional)"
                  className="h-9"
                />
              </div>
            </Tarjeta>
          ))}
          <Boton variante="secundario" onClick={() => setPasos([...pasos, filaPasoVacia()])} className="self-start">
            <Plus /> Paso
          </Boton>
        </section>

        <Tarjeta className="flex flex-col gap-4 p-4">
          <Campo etiqueta="Preparación previa" ayuda="Lo que hay que hacer con antelación. Se usará para avisaros (fase 5).">
            <Entrada value={previa} onChange={(e) => setPrevia(e.target.value)} placeholder="Poner los garbanzos en remojo" />
          </Campo>
          {previa.trim() && (
            <Campo etiqueta="Horas de antelación">
              <Entrada inputMode="numeric" value={previaHoras} onChange={(e) => setPreviaHoras(e.target.value)} placeholder="12" className="w-28" />
            </Campo>
          )}
          <Campo etiqueta="Notas">
            <AreaTexto value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="La próxima vez, menos sal" />
          </Campo>
        </Tarjeta>

        <div className="pb-seguro sticky bottom-0 z-10 -mx-4 border-t border-borde/70 bg-fondo/90 px-4 pt-3 backdrop-blur-xl md:mx-0 md:px-0">
          <Boton tamano="lg" className="w-full" onClick={guardar} disabled={!valida || guardando}>
            <Check /> {guardando ? "Guardando…" : "Guardar receta"}
          </Boton>
          {errorCantidad && <p className="mt-1.5 text-center text-sm text-peligro">Cada ingrediente necesita una cantidad mayor que 0.</p>}
          <div className="h-3" />
        </div>
      </div>
    </>
  );
}
