import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, Timer, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Campo, Contador, Entrada, Opciones } from "@/components/ui/campos";
import { Estrellas } from "@/components/ui/estrellas";
import { Cargando, Tarjeta } from "@/components/ui/varios";
import { buscarIngrediente } from "@/dominio/lista";
import { normalizar } from "@/dominio/texto";
import type { UnidadBase } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { RecetaCompleta } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, useIngredientes, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";

interface FilaIngrediente {
  clave: string;
  nombre: string;
  cantidad: string;
  opcional: boolean;
  unidadNueva: UnidadBase;
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
  const [cargada, setCargada] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (original && !cargada) {
      cargar(original);
      setCargada(true);
    }
  }, [original, cargada]);

  function cargar(r: RecetaCompleta) {
    setNombre(r.nombre);
    setRaciones(r.raciones);
    setPrep(r.tiempo_prep_min?.toString() ?? "");
    setCoccion(r.tiempo_coccion_min?.toString() ?? "");
    setPrevia(r.preparacion_previa ?? "");
    setPreviaHoras(r.preparacion_previa_horas?.toString() ?? "");
    setEtiquetas(r.etiquetas.join(", "));
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
        let ingredienteId = buscarIngrediente(f.nombre, ingredientes)?.id ?? creados.get(normalizar(f.nombre));
        if (!ingredienteId) {
          const { data, error } = await supabase
            .from("ingrediente")
            .insert({ hogar_id: hogar.id, nombre: f.nombre.trim(), unidad_base: f.unidadNueva })
            .select("id")
            .single();
          if (error) throw error;
          ingredienteId = data.id as string;
          creados.set(normalizar(f.nombre), ingredienteId);
        }
        lineas.push({ ingrediente_id: ingredienteId, cantidad: numero(f.cantidad), opcional: f.opcional });
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
          etiquetas: [...new Set(etiquetas.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))],
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
    if (!original || !window.confirm(`¿Borrar «${original.nombre}»? Las franjas del menú que la usan quedarán vacías.`)) return;
    const { error } = await supabase.from("receta").delete().eq("id", original.id);
    if (error) return toast.error(mensajeError(error));
    await queryClient.invalidateQueries({ queryKey: claves.recetas(hogar.id) });
    queryClient.invalidateQueries({ queryKey: claves.franjas(hogar.id) });
    navigate("/recetas", { replace: true });
  }

  if (id && isPending) return <Cargando />;

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 md:px-0">
      <div className="flex items-center justify-between">
        <Link to={original ? `/recetas/${original.id}` : "/recetas"} className="inline-flex items-center gap-1 text-sm text-suave">
          <ArrowLeft className="size-4" /> {original ? "Receta" : "Recetas"}
        </Link>
        {original && (
          <Boton variante="peligro" tamano="sm" onClick={borrar}>
            <Trash2 /> Borrar
          </Boton>
        )}
      </div>
      <h1 className="text-[28px] font-bold tracking-tight">{original ? "Editar receta" : "Nueva receta"}</h1>

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
        <Campo etiqueta="Etiquetas" ayuda="Separadas por comas: legumbre, rápida, invierno…">
          <Entrada value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="legumbre, cuchara" />
        </Campo>
      </Tarjeta>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ingredientes</h2>
          <p className="text-sm text-suave">Cantidades para {raciones} {raciones === 1 ? "ración" : "raciones"}, en gramos, mililitros o unidades.</p>
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
                <Entrada list="receta-ingredientes" value={f.nombre} onChange={(e) => cambiarFila(f.clave, { nombre: e.target.value })} placeholder="Ingrediente" />
                <div className="relative w-28 shrink-0">
                  <Entrada
                    inputMode="decimal"
                    value={f.cantidad}
                    onChange={(e) => cambiarFila(f.clave, { cantidad: e.target.value })}
                    placeholder="0"
                    className={cn("pr-9 text-right", cantidadMal && "border-peligro")}
                    aria-label="Cantidad"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-suave">{unidad}</span>
                </div>
                <Boton variante="fantasma" tamano="icono" aria-label="Quitar ingrediente" onClick={() => setFilas(filas.length > 1 ? filas.filter((x) => x.clave !== f.clave) : [filaIngredienteVacia()])}>
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
                  <input type="checkbox" checked={f.opcional} onChange={(e) => cambiarFila(f.clave, { opcional: e.target.checked })} className="size-4 accent-[var(--primario)]" />
                  Opcional
                </label>
              </div>
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
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primario text-sm font-semibold text-primario-texto">{i + 1}</span>
              <AreaTexto value={p.texto} onChange={(e) => cambiarPaso(p.clave, { texto: e.target.value })} placeholder="Describe el paso" rows={2} />
              <Boton variante="fantasma" tamano="icono" aria-label="Quitar paso" onClick={() => setPasos(pasos.length > 1 ? pasos.filter((x) => x.clave !== p.clave) : [filaPasoVacia()])}>
                <X />
              </Boton>
            </div>
            <div className="ml-9 flex items-center gap-2">
              <Timer className="size-4 shrink-0 text-suave" />
              <Entrada inputMode="numeric" value={p.minutos} onChange={(e) => cambiarPaso(p.clave, { minutos: e.target.value })} placeholder="min" className="h-9 w-20" aria-label="Minutos del temporizador" />
              <Entrada value={p.nombreTemporizador} onChange={(e) => cambiarPaso(p.clave, { nombreTemporizador: e.target.value })} placeholder="Nombre del temporizador (opcional)" className="h-9" />
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

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-borde bg-fondo/90 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
        <Boton tamano="lg" className="w-full" onClick={guardar} disabled={!valida || guardando}>
          <Check /> {guardando ? "Guardando…" : "Guardar receta"}
        </Boton>
        {errorCantidad && <p className="mt-1.5 text-center text-sm text-peligro">Cada ingrediente necesita una cantidad mayor que 0.</p>}
      </div>
    </div>
  );
}
