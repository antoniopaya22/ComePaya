import { useQueryClient } from "@tanstack/react-query";
import { Baby, Check, ChefHat, CircleCheck, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Contador, Entrada, Interruptor, Opciones } from "@/components/ui/campos";
import { Estrellas } from "@/components/ui/estrellas";
import { useConfirmar } from "@/components/ui/confirmar";
import { Hoja, useCambiosSinGuardar } from "@/components/ui/hoja";
import { alimentosNuevos, recetasPara, type ParaFranja } from "@/dominio/bebe";
import { hoyISO, type FechaISO } from "@/dominio/caducidad";
import { DIAS_SEMANA, racionesACocinar, type TipoFranja } from "@/dominio/menu";
import { normalizar } from "@/dominio/texto";
import { supabase } from "@/lib/supabase";
import type { FranjaMenu } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, consultarLotes, useAlergenosIngredientes, useIngredientes, useRecetas } from "../datos";
import { ChipsAlergenos } from "../salud/Alergenos";
import { useHogar } from "../hogar/HogarProvider";
import { avisarConDeshacer, deshacerDespensa } from "../despensa/deshacer";
import { cocinarFranja } from "./cocinar";
import { claveRechazos, useSugerencias } from "./useSugerencias";

type Modo = "receta" | "sobras" | "fuera";

const diaDe = (fecha: FechaISO) => DIAS_SEMANA[(new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7];
const anterior = (a: FranjaMenu, fecha: FechaISO, tipo: TipoFranja) => a.fecha < fecha || (a.fecha === fecha && a.tipo === "comida" && tipo === "cena");

export function FranjaHoja({
  hueco,
  franja,
  franjasSemana,
  onCerrar,
}: {
  hueco: { fecha: FechaISO; tipo: TipoFranja; para: ParaFranja } | null;
  franja: FranjaMenu | undefined;
  franjasSemana: FranjaMenu[];
  onCerrar: () => void;
}) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: recetas = [] } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const alergenosIngrediente = useAlergenosIngredientes();
  // El bebé come una ración; la casa, los comensales.
  const racionesPorDefecto = (para?: ParaFranja) => (para === "bebe" ? 1 : (hogar.comensales ?? 2));

  const [modo, setModo] = useState<Modo>("receta");
  const [recetaId, setRecetaId] = useState<string | null>(null);
  const [raciones, setRaciones] = useState(racionesPorDefecto(hueco?.para));
  const [sobraDe, setSobraDe] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [descontar, setDescontar] = useState(true);
  const [congelar, setCongelar] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [actual, setActual] = useState(hueco);
  // Cómo estaba la comida al abrir, para avisar si otro móvil la cambia mientras tanto.
  const [alAbrir, setAlAbrir] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const sucio = useCambiosSinGuardar(hueco !== null, [modo, recetaId, raciones, sobraDe]);

  useEffect(() => {
    if (!hueco) return;
    setActual(hueco);
    setAlAbrir(resumenFranja(franja));
    setModo(franja?.fuera_de_casa ? "fuera" : franja?.es_sobra_de ? "sobras" : "receta");
    setRecetaId(franja?.receta_id ?? null);
    setRaciones(franja?.raciones ?? racionesPorDefecto(hueco.para));
    setSobraDe(franja?.es_sobra_de ?? null);
    setBusqueda("");
    setDescontar(true);
    setCongelar(0);
    // Solo al abrir otra franja: los cambios en tiempo real no deben pisar lo que se está editando.
  }, [hueco?.fecha, hueco?.tipo, hueco?.para]);

  const para = actual?.para ?? hueco?.para ?? "casa";
  const candidatas = useMemo(() => {
    const texto = normalizar(busqueda);
    // Primero las recetas de su tipo (de bebé o de la casa); buscando salen también las demás.
    const propias = recetasPara(para, recetas);
    const ordenadas = texto ? [...propias, ...recetas.filter((r) => !propias.includes(r))] : propias;
    return ordenadas.filter((r) => !texto || normalizar(`${r.nombre} ${r.etiquetas.join(" ")}`).includes(texto));
  }, [recetas, busqueda, para]);

  const sugerencias = useSugerencias(actual?.fecha ?? hueco?.fecha ?? "2000-01-01", raciones, franja?.id, franjasSemana, para);

  async function rechazar(id: string) {
    const { error } = await supabase.from("rechazo_sugerencia").insert({ hogar_id: hogar.id, receta_id: id, fecha: hoyISO() });
    if (error) return toast.error(mensajeError(error));
    queryClient.invalidateQueries({ queryKey: claveRechazos(hogar.id) });
  }

  if (!actual) return null;
  const { fecha, tipo } = actual;
  const origenes = franjasSemana.filter((f) => f.receta_id && !f.es_sobra_de && !f.fuera_de_casa && anterior(f, fecha, tipo));
  const receta = recetas.find((r) => r.id === recetaId);
  const bebe = hogar.bebe_nombre ?? "el bebé";
  // Lo que el bebé aún no ha probado del plato elegido (o del de las sobras).
  const platoBebe =
    para === "bebe"
      ? modo === "sobras"
        ? recetas.find((r) => r.id === origenes.find((f) => f.id === sobraDe)?.receta_id)
        : modo === "receta"
          ? receta
          : undefined
      : undefined;
  const introducidos = new Map(ingredientes.map((i) => [i.id, i.bebe_introducido]));
  const nuevos = platoBebe ? alimentosNuevos(platoBebe.ingredientes, introducidos) : [];
  const nombreDe = (id: string) => ingredientes.find((i) => i.id === id)?.nombre.toLowerCase() ?? "";
  const alergenosNuevos = [...new Set(nuevos.flatMap((id) => alergenosIngrediente.get(id) ?? []))];
  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.franjas(hogar.id) });

  async function guardar() {
    if (alAbrir !== null && resumenFranja(franja) !== alAbrir) {
      const ahora = franja?.fuera_de_casa ? "fuera de casa" : franja?.receta_id ? `«${recetas.find((r) => r.id === franja.receta_id)?.nombre ?? "otra receta"}»` : "vacía";
      const seguir = await confirmar({
        titulo: "La han cambiado desde otro móvil",
        mensaje: `Mientras la tenías abierta, esta comida ha pasado a estar ${ahora}. ¿Guardar la tuya igualmente?`,
        aceptar: "Guardar la mía",
      });
      if (!seguir) return onCerrar();
    }
    const origen = origenes.find((f) => f.id === sobraDe);
    const fila = {
      hogar_id: hogar.id,
      fecha,
      tipo,
      para,
      receta_id: modo === "receta" ? recetaId : modo === "sobras" ? (origen?.receta_id ?? null) : null,
      raciones,
      fuera_de_casa: modo === "fuera",
      es_sobra_de: modo === "sobras" ? sobraDe : null,
      // Otro plato distinto ya no está cocinado (si no, dejaría de contar para la lista y los avisos).
      ...(franja?.cocinado && (modo !== "receta" || franja.receta_id !== recetaId) ? { cocinado: false } : {}),
    };
    setOcupado(true);
    const { error } = await supabase.from("franja_menu").upsert(fila, { onConflict: "hogar_id,fecha,tipo,para" });
    setOcupado(false);
    if (error) return toast.error(mensajeError(error));
    refrescar();
    onCerrar();
  }

  async function vaciar() {
    if (franja) {
      const { error } = await supabase.from("franja_menu").delete().eq("id", franja.id);
      if (error) return toast.error(mensajeError(error));
      refrescar();
      const copia = { ...franja };
      avisarConDeshacer(queryClient, hogar.id, "Franja vaciada", async () => {
        const { error } = await supabase.from("franja_menu").upsert(copia, { onConflict: "hogar_id,fecha,tipo,para" });
        if (error) throw error;
      });
    }
    onCerrar();
  }

  async function alternarCocinado() {
    if (!franja) return;
    setOcupado(true);
    try {
      if (franja.cocinado || !receta) {
        // Desmarcar no devuelve nada a la despensa.
        const { error } = await supabase.from("franja_menu").update({ cocinado: !franja.cocinado }).eq("id", franja.id);
        if (error) throw error;
      } else {
        // Se cocina también para las franjas que comerán sobras de esta. Lotes recién leídos, no de la caché.
        const racionesCocinadas = racionesACocinar(franjasSemana).get(franja.id) ?? franja.raciones;
        const lotesFrescos = descontar
          ? await queryClient.fetchQuery({ queryKey: claves.lotes(hogar.id), queryFn: () => consultarLotes(hogar.id), staleTime: 0 })
          : [];
        const { faltaba, antes } = await cocinarFranja({
          hogarId: hogar.id,
          franjaId: franja.id,
          receta,
          raciones: racionesCocinadas,
          descontar,
          congelar,
          lotes: lotesFrescos,
          ingredientes,
        });
        queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });
        queryClient.invalidateQueries({ queryKey: claves.raciones(hogar.id) });
        const primeraVez = para === "bebe" ? nuevos : [];
        if (primeraVez.length) {
          // Lo que ha comido por primera vez queda apuntado como probado.
          const { error } = await supabase.from("ingrediente").update({ bebe_introducido: fecha }).in("id", primeraVez).is("bebe_introducido", null);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
        }
        const deshacer = async () => {
          await deshacerDespensa(hogar.id, antes);
          if (primeraVez.length) {
            const { error } = await supabase.from("ingrediente").update({ bebe_introducido: null }).in("id", primeraVez).eq("bebe_introducido", fecha);
            if (error) throw error;
          }
        };
        const detalles = [
          descontar ? (faltaba.length ? `Descontado de la despensa; no había: ${faltaba.join(", ")}.` : "Descontado de la despensa.") : null,
          primeraVez.length ? `Primera vez para ${bebe}: ${primeraVez.map(nombreDe).join(", ")}, apuntado como probado.` : null,
        ].filter(Boolean);
        avisarConDeshacer(queryClient, hogar.id, "Marcado como cocinado", deshacer, {
          descripcion: detalles.join(" ") || undefined,
          tipo: faltaba.length ? "info" : "success",
        });
      }
      refrescar();
      onCerrar();
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setOcupado(false);
    }
  }

  const listo = modo === "fuera" || (modo === "receta" && recetaId) || (modo === "sobras" && sobraDe);
  const motivoNoListo = modo === "sobras" ? "Elige de qué comida son las sobras" : "Elige una receta de la lista";
  const cocinable = franja && franja.receta_id && !franja.fuera_de_casa;

  return (
    <Hoja
      sucio={sucio}
      abierta={hueco !== null}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo={`${diaDe(fecha)} · ${tipo === "comida" ? "Comida" : "Cena"}${para === "bebe" ? ` de ${bebe}` : ""}`}
      pie={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Boton variante="peligro" tamano="icono" onClick={vaciar} aria-label="Vaciar franja" disabled={ocupado}>
            <Trash2 />
          </Boton>
          <Boton onClick={() => (listo ? guardar() : toast.error(motivoNoListo))} disabled={ocupado}>
            <Check /> Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {cocinable && !franja.es_sobra_de && (
          <div className="flex flex-col gap-2 rounded-2xl bg-primario-suave p-3">
            {!franja.cocinado && receta && (
              <>
                <Interruptor marcado={descontar} onChange={setDescontar} etiqueta="Descontar de la despensa" ayuda="Gasta primero lo que antes caduca. Puedes corregirlo después." />
                <div className="flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie px-3.5 py-2">
                  <span className="text-[15px] font-medium">Raciones a congelar</span>
                  <div className="w-36">
                    <Contador valor={congelar} onChange={(v) => setCongelar(Math.max(0, Math.round(v)))} min={0} />
                  </div>
                </div>
              </>
            )}
            <Boton variante={franja.cocinado ? "secundario" : "primario"} onClick={alternarCocinado} disabled={ocupado}>
              <CircleCheck /> {franja.cocinado ? "Marcar como no cocinado" : "Ya lo he cocinado"}
            </Boton>
            {franja.cocinado && <p className="text-center text-xs text-suave">Desmarcarlo no devuelve los ingredientes a la despensa.</p>}
          </div>
        )}

        <Opciones<Modo>
          opciones={[
            { valor: "receta", etiqueta: "Receta" },
            { valor: "sobras", etiqueta: "Sobras" },
            { valor: "fuera", etiqueta: "Fuera de casa" },
          ]}
          valor={modo}
          onChange={setModo}
        />

        {modo !== "fuera" && (
          <Campo etiqueta="Raciones" ayuda={modo === "sobras" ? "Se suman a las que se cocinan en la franja de origen." : undefined}>
            <Contador valor={raciones} onChange={(v) => setRaciones(Math.max(1, Math.round(v)))} min={1} />
          </Campo>
        )}

        {nuevos.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl bg-aviso-suave p-3 text-aviso">
            <p className="flex items-start gap-2 text-sm font-medium">
              <Baby className="mt-0.5 size-4 shrink-0" />
              <span>
                Primera vez para {bebe}: {nuevos.map(nombreDe).join(", ")}.
              </span>
            </p>
            {alergenosNuevos.length > 0 && <ChipsAlergenos alergenos={alergenosNuevos} />}
          </div>
        )}

        {modo === "receta" && !busqueda && sugerencias.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-suave">
              <Sparkles className="size-4 text-primario" /> Sugerencias
            </h3>
            {sugerencias.slice(0, 3).map((s) => (
              <div key={s.receta_id} className={cn("flex items-start gap-2 rounded-xl border p-3", recetaId === s.receta_id ? "border-primario bg-primario-suave" : "border-borde")}>
                <button className="min-w-0 flex-1 text-left" onClick={() => setRecetaId(s.receta_id)}>
                  <span className="block font-medium">{s.nombre}</span>
                  <span className="block text-xs text-suave">{s.motivos.slice(0, 2).join(" · ") || "Sin datos para explicarla"}</span>
                </button>
                <Boton variante="fantasma" tamano="sm" className="h-8 shrink-0 px-2 text-xs text-suave" onClick={() => rechazar(s.receta_id)}>
                  No me apetece
                </Boton>
              </div>
            ))}
          </section>
        )}

        {modo === "receta" &&
          (recetas.length ? (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
                <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar receta" className="pl-10" type="search" />
              </div>
              <ul className="flex flex-col">
                {candidatas.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setRecetaId(r.id)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", recetaId === r.id ? "bg-primario-suave" : "hover:bg-superficie-2")}
                    >
                      <ChefHat className={cn("size-4 shrink-0", recetaId === r.id ? "text-primario" : "text-suave")} />
                      <span className="flex-1 truncate font-medium">{r.nombre}</span>
                      {r.valoracion && <Estrellas valor={r.valoracion} />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-suave">
              Aún no hay recetas.{" "}
              <Link to="/recetas/nueva" className="font-medium text-primario">
                Crea la primera
              </Link>
              .
            </p>
          ))}

        {modo === "sobras" &&
          (origenes.length ? (
            <ul className="flex flex-col gap-1">
              {origenes.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => setSobraDe(f.id)}
                    className={cn("flex w-full flex-col rounded-xl px-3 py-2.5 text-left", sobraDe === f.id ? "bg-primario-suave" : "hover:bg-superficie-2")}
                  >
                    <span className="font-medium">{recetas.find((r) => r.id === f.receta_id)?.nombre}</span>
                    <span className="text-xs text-suave">
                      {diaDe(f.fecha)} · {f.tipo}
                      {f.para === "bebe" ? ` de ${bebe}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">No hay platos cocinados antes en esta semana de los que puedan quedar sobras.</p>
          ))}
      </div>
    </Hoja>
  );
}

/** Lo que importa de una franja para saber si otro la ha cambiado. */
function resumenFranja(f: FranjaMenu | undefined): string {
  return JSON.stringify(f ? [f.receta_id, f.fuera_de_casa, f.es_sobra_de, f.raciones] : null);
}
