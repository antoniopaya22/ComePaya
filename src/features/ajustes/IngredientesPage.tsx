import { useQueryClient } from "@tanstack/react-query";
import { Carrot, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { BarraApp, BotonBarra } from "@/components/BarraApp";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Interruptor, Opciones, Selector } from "@/components/ui/campos";
import { Hoja, useCambiosSinGuardar } from "@/components/ui/hoja";
import { ErrorCarga, Etiqueta, ListaEsqueleto, Tarjeta, Vacio } from "@/components/ui/varios";
import { datosBaseDe, emojiPara, ingredientesBaseQueFaltan } from "@/dominio/ingredientes-base";
import { seccionesDisponibles } from "@/dominio/lista";
import { normalizar } from "@/dominio/texto";
import { formatearCantidad, UNIDADES_BASE, type UnidadBase } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import type { Ingrediente } from "@/lib/tipos";
import { camposCambiados, mensajeError } from "@/lib/utils";
import { CLAVES_NUTRIENTES, GRUPOS_ALIMENTO, type GrupoAlimento } from "@/dominio/nutricion";
import type { Nutrientes100 } from "@/dominio/producto-externo";
import { claves, useIngredientes, useNutrientesIngredientes, useProductos, useRecetas, useTiendas } from "../datos";
import { cargarIngredientesBase } from "../despensa/altas";
import { SelectorAlergenos } from "../salud/Alergenos";
import { necesitaPesoUnidad } from "@/dominio/fusion";
import { cambiarUnidad } from "../productos/fusionar";
import { PasarAUnidades } from "../productos/PasarAUnidades";
import { useHogar } from "../hogar/HogarProvider";

/** Equivalencias propias de medidas caseras; las vacías usan las estándar. */
function equivalenciasDe(cucharada: string, vaso: string): Record<string, number> | null {
  const resultado: Record<string, number> = {};
  const c = Number(cucharada.replace(",", "."));
  const v = Number(vaso.replace(",", "."));
  if (cucharada.trim() && c > 0) {
    resultado.cucharada = c;
    resultado.cucharadita = Math.round((c / 3) * 10) / 10;
  }
  if (vaso.trim() && v > 0) resultado.vaso = v;
  return Object.keys(resultado).length ? resultado : null;
}

function nutrientesManuales(valores: Partial<Record<keyof Nutrientes100, string>>): Nutrientes100 | null {
  const resultado: Nutrientes100 = {};
  for (const [clave, texto] of Object.entries(valores) as [keyof Nutrientes100, string][]) {
    const n = Number(texto?.replace(",", "."));
    if (texto?.trim() && Number.isFinite(n) && n >= 0) resultado[clave] = n;
  }
  return Object.keys(resultado).length ? resultado : null;
}

export function IngredientesPage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes, isPending, error: errorCarga, refetch: recargar } = useIngredientes();
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Ingrediente | "nuevo" | null>(null);
  const [cargando, setCargando] = useState(false);
  const faltan = ingredientes ? ingredientesBaseQueFaltan(ingredientes).length : 0;

  async function cargarHabituales() {
    setCargando(true);
    try {
      const n = await cargarIngredientesBase(hogar.id, ingredientes ?? []);
      void queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
      toast.success(`${n} ingredientes añadidos`);
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setCargando(false);
    }
  }

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return (ingredientes ?? []).filter((i) => !texto || normalizar(i.nombre).includes(texto));
  }, [ingredientes, busqueda]);

  return (
    <>
      <BarraApp
        titulo="Ingredientes"
        atras="/ajustes"
        subtitulo="Lo que piden las recetas. Cada producto apunta a uno."
        acciones={
          <BotonBarra etiqueta="Nuevo ingrediente" onClick={() => setEditando("nuevo")} className="md:hidden">
            <Plus />
          </BotonBarra>
        }
        principal={
          <Boton tamano="sm" onClick={() => setEditando("nuevo")}>
            <Plus /> Nuevo
          </Boton>
        }
      />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <PasarAUnidades />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar ingrediente"
            className="h-11 rounded-full border-transparent bg-superficie-2 pl-10 md:rounded-xl md:border-borde md:bg-superficie"
            type="search"
              enterKeyHint="search"
              autoComplete="off"
          />
        </div>
        {faltan > 0 && !busqueda && (
          <Tarjeta className="flex items-center gap-3 border-primario/30 bg-primario-suave p-3.5">
            <span className="text-2xl">🧺</span>
            <p className="flex-1 text-sm">
              Hay <strong>{faltan} ingredientes habituales</strong> que aún no tenéis, con su sección, grupo e icono.
            </p>
            <Boton tamano="sm" onClick={cargarHabituales} disabled={cargando}>
              {cargando ? "Añadiendo…" : "Añadir"}
            </Boton>
          </Tarjeta>
        )}
        {isPending ? (
          <ListaEsqueleto />
        ) : errorCarga && !ingredientes ? (
          <ErrorCarga error={errorCarga} onReintentar={() => void recargar()} />
        ) : !visibles.length ? (
          <Vacio icono={<Carrot />} titulo="Sin ingredientes" />
        ) : (
          <Tarjeta className="divide-y divide-borde">
            {visibles.map((i) => (
              <Link key={i.id} to={`/ingredientes/${i.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-superficie-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-superficie-2 text-lg">
                  {emojiPara(i.nombre, i.seccion_super, i.emoji)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{i.nombre}</span>
                  <span className="block truncate text-sm text-suave">
                    {i.seccion_super} · {UNIDADES_BASE.find((u) => u.valor === i.unidad_base)?.etiqueta.toLowerCase()}
                    {i.stock_minimo ? ` · mínimo ${formatearCantidad(i.stock_minimo, i.unidad_base)}` : ""}
                  </span>
                </span>
                {i.siempre_disponible && <Etiqueta tono="primario">Básico</Etiqueta>}
              </Link>
            ))}
          </Tarjeta>
        )}
      </div>
      <IngredienteHoja ingrediente={editando} onCerrar={() => setEditando(null)} />
    </>
  );
}

export function IngredienteHoja({ ingrediente, onCerrar }: { ingrediente: Ingrediente | "nuevo" | null; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: tiendas = [] } = useTiendas();
  const { data: ingredientes = [] } = useIngredientes();
  const [nombre, setNombre] = useState("");
  const [emoji, setEmoji] = useState("");
  const [unidad, setUnidad] = useState<UnidadBase>("g");
  const [seccion, setSeccion] = useState("Otros");
  const [basico, setBasico] = useState(false);
  const [stockMinimo, setStockMinimo] = useState("");
  const [caducidadDias, setCaducidadDias] = useState("");
  const [grupo, setGrupo] = useState<GrupoAlimento | "">("");
  const [pesoUnidad, setPesoUnidad] = useState("");
  const [alergenos, setAlergenos] = useState<string[]>([]);
  const [diasAbrir, setDiasAbrir] = useState("");
  const [eqCucharada, setEqCucharada] = useState("");
  const [eqVaso, setEqVaso] = useState("");
  const [nutrientes, setNutrientes] = useState<Partial<Record<keyof Nutrientes100, string>>>({});
  const sucio = useCambiosSinGuardar(ingrediente !== null, [
    nombre, emoji, unidad, seccion, basico, stockMinimo, caducidadDias, grupo, pesoUnidad, alergenos, diasAbrir, eqCucharada, eqVaso, nutrientes,
  ]);
  const calculados = useNutrientesIngredientes();
  const { data: productos = [] } = useProductos();
  const { data: recetas = [] } = useRecetas();
  const enUso =
    ingrediente !== null &&
    ingrediente !== "nuevo" &&
    (productos.some((p) => p.ingrediente_id === ingrediente.id) ||
      recetas.some((r) => r.ingredientes.some((ri) => ri.ingrediente_id === ingrediente.id)));

  useEffect(() => {
    if (!ingrediente) return;
    const i = ingrediente === "nuevo" ? null : ingrediente;
    setGrupo(i?.grupo_alimento ?? "");
    setPesoUnidad(i?.peso_unidad_g?.toString() ?? "");
    setAlergenos(i?.alergenos ?? []);
    setDiasAbrir(i?.dias_tras_abrir?.toString() ?? "");
    setEqCucharada(i?.equivalencias?.cucharada?.toString().replace(".", ",") ?? "");
    setEqVaso(i?.equivalencias?.vaso?.toString().replace(".", ",") ?? "");
    setNutrientes(Object.fromEntries(Object.entries(i?.nutrientes_100 ?? {}).map(([clave, valor]) => [clave, String(valor).replace(".", ",")])));
    setNombre(i?.nombre ?? "");
    setEmoji(i?.emoji ?? "");
    setUnidad(i?.unidad_base ?? "g");
    setSeccion(i?.seccion_super ?? "Otros");
    setBasico(i?.siempre_disponible ?? false);
    setStockMinimo(i?.stock_minimo?.toString() ?? "");
    setCaducidadDias(i?.caducidad_defecto_dias?.toString() ?? "");
  }, [ingrediente]);

  const secciones = seccionesDisponibles(tiendas[0]?.orden_secciones ?? [], [...ingredientes.map((i) => i.seccion_super), seccion]);
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
    void queryClient.invalidateQueries({ queryKey: claves.productos(hogar.id) });
    void queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });
  };

  const original = ingrediente && ingrediente !== "nuevo" ? ingrediente : null;
  const cambiaUnidad = Boolean(enUso && original && unidad !== original.unidad_base);
  const pesoNumero = Number(pesoUnidad.replace(",", ".")) || null;
  const faltaPeso = cambiaUnidad && necesitaPesoUnidad(original!.unidad_base, unidad) && !pesoNumero;

  async function guardar() {
    if (cambiaUnidad) {
      // Ya tiene recetas o despensa: se convierten sus cantidades antes de guardar lo demás.
      try {
        await cambiarUnidad(original!, unidad, pesoNumero);
        void queryClient.invalidateQueries({ queryKey: claves.recetas(hogar.id) });
        void queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });
      } catch (error) {
        return toast.error(mensajeError(error));
      }
    }
    const datos = {
      nombre: nombre.trim(),
      emoji: emoji.trim() || null,
      unidad_base: unidad,
      seccion_super: seccion,
      siempre_disponible: basico,
      // Al cambiar de unidad, el stock mínimo ya lo ha convertido cambiarUnidad.
      ...(cambiaUnidad ? {} : { stock_minimo: stockMinimo ? Number(stockMinimo.replace(",", ".")) : null }),
      caducidad_defecto_dias: caducidadDias ? Math.round(Number(caducidadDias)) : null,
      grupo_alimento: grupo || null,
      peso_unidad_g: unidad === "ud" && pesoUnidad ? Number(pesoUnidad.replace(",", ".")) : null,
      nutrientes_100: nutrientesManuales(nutrientes),
      alergenos,
      dias_tras_abrir: diasAbrir ? Math.round(Number(diasAbrir)) || null : null,
      ...(cambiaUnidad ? {} : { equivalencias: equivalenciasDe(eqCucharada, eqVaso) }),
    };
    if (ingrediente === "nuevo") {
      const { error } = await supabase.from("ingrediente").insert({ ...datos, hogar_id: hogar.id });
      if (error) return toast.error(mensajeError(error));
    } else {
      // Solo lo que se ha tocado: si otro móvil ha cambiado otros datos mientras tanto, se conservan.
      const cambios = camposCambiados(ingrediente as Ingrediente, datos as Partial<Ingrediente>);
      if (Object.keys(cambios).length) {
        const { data, error } = await supabase
          .from("ingrediente")
          .update(cambios)
          .eq("id", (ingrediente as Ingrediente).id)
          .select("id");
        if (error) return toast.error(mensajeError(error));
        if (!data?.length) {
          toast.error("Este ingrediente ya no existe: lo han borrado desde otro móvil");
          refrescar();
          return onCerrar();
        }
      }
    }
    refrescar();
    onCerrar();
  }

  async function borrar() {
    if (!ingrediente || ingrediente === "nuevo") return;
    const { error } = await supabase.from("ingrediente").delete().eq("id", ingrediente.id);
    if (error) return toast.error(mensajeError(error));
    refrescar();
    const copia = { ...ingrediente };
    toast(`${ingrediente.nombre} borrado`, {
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const { error } = await supabase.from("ingrediente").insert(copia);
          if (error) toast.error(mensajeError(error));
          refrescar();
        },
      },
    });
    onCerrar();
  }

  return (
    <Hoja
      sucio={sucio}
      abierta={ingrediente !== null}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo={ingrediente === "nuevo" ? "Nuevo ingrediente" : "Ingrediente"}
      pie={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          {ingrediente !== "nuevo" && (
            <Boton variante="peligro" tamano="icono" onClick={borrar} aria-label="Borrar ingrediente">
              <Trash2 />
            </Boton>
          )}
          <Boton onClick={guardar} disabled={!nombre.trim() || faltaPeso} className={ingrediente === "nuevo" ? "col-span-2" : ""}>
            Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <Campo etiqueta="Icono">
            <Entrada
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={emojiPara(nombre, seccion)}
              className="text-center text-xl"
              maxLength={8}
            />
          </Campo>
          <Campo etiqueta="Nombre">
            <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Garbanzos cocidos" />
          </Campo>
        </div>
        <Campo
          etiqueta="Se mide en"
          ayuda={cambiaUnidad ? "Al guardar se convierten las cantidades de sus recetas, la despensa y la lista." : undefined}
        >
          <Opciones
            opciones={UNIDADES_BASE}
            valor={unidad}
            onChange={(u) => {
              setUnidad(u);
              // Lo que pesa una pieza, si es un ingrediente conocido.
              if (u === "ud" && !pesoUnidad) setPesoUnidad(datosBaseDe(nombre).peso_unidad_g?.toString() ?? "");
            }}
          />
        </Campo>
        {cambiaUnidad && necesitaPesoUnidad(original!.unidad_base, unidad) && (
          <Campo
            etiqueta={`¿Cuántos ${unidad === "ud" ? original!.unidad_base : unidad} pesa una unidad?`}
            ayuda="Para pasar las cantidades. Por ejemplo, una patata mediana ≈ 200 g."
          >
            <Entrada inputMode="decimal" value={pesoUnidad} onChange={(e) => setPesoUnidad(e.target.value)} placeholder="200" />
          </Campo>
        )}
        <Campo etiqueta="Sección del súper">
          <Selector value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            {secciones.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Selector>
        </Campo>
        <Interruptor
          marcado={basico}
          onChange={setBasico}
          etiqueta="Básico, siempre hay"
          ayuda="Sal, aceite, especias… No se inventaría ni cuenta como faltante."
        />
        <Campo etiqueta="Grupo de alimentos" ayuda="Para el equilibrio semanal del menú.">
          <Selector value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoAlimento | "")}>
            <option value="">Ninguno</option>
            {GRUPOS_ALIMENTO.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.etiqueta}
              </option>
            ))}
          </Selector>
        </Campo>
        {unidad === "ud" && !cambiaUnidad && (
          <Campo etiqueta="Peso de una unidad (g)" ayuda="Para calcular los nutrientes de las recetas. Un huevo ≈ 60 g.">
            <Entrada inputMode="decimal" value={pesoUnidad} onChange={(e) => setPesoUnidad(e.target.value)} placeholder="—" className="w-32" />
          </Campo>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-suave">Alérgenos</span>
          <SelectorAlergenos valor={alergenos} onChange={setAlergenos} />
          <span className="text-xs text-suave">Los de sus productos escaneados se suman solos.</span>
        </div>
        {unidad !== "ud" && (
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta={`1 cucharada = (${unidad})`} ayuda="Por defecto, 15.">
              <Entrada inputMode="decimal" value={eqCucharada} onChange={(e) => setEqCucharada(e.target.value)} placeholder="15" />
            </Campo>
            <Campo etiqueta={`1 vaso = (${unidad})`} ayuda="Por defecto, 200.">
              <Entrada inputMode="decimal" value={eqVaso} onChange={(e) => setEqVaso(e.target.value)} placeholder="200" />
            </Campo>
          </div>
        )}
        <Campo etiqueta="Una vez abierto, dura (días)" ayuda="Al marcar un envase como abierto, su caducidad se acorta a esto.">
          <Entrada
            inputMode="numeric"
            value={diasAbrir}
            onChange={(e) => setDiasAbrir(e.target.value.replace(/\D/g, ""))}
            placeholder="—"
            className="w-28"
          />
        </Campo>
        <details className="rounded-xl border border-borde px-3.5 py-3">
          <summary className="cursor-pointer text-sm font-medium">Valores nutricionales por 100 g</summary>
          <p className="mt-2 text-xs text-suave">
            Déjalos vacíos para usar la media de sus productos escaneados
            {ingrediente && ingrediente !== "nuevo" && !ingrediente.nutrientes_100 && calculados.get(ingrediente.id) ? " (se muestran en gris)" : ""}.
            Para frescos, puedes copiarlos de BEDCA (bedca.net).
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            {CLAVES_NUTRIENTES.map(({ clave, etiqueta, unidad: u }) => (
              <label key={clave} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {etiqueta} <span className="text-suave">({u})</span>
                </span>
                <Entrada
                  inputMode="decimal"
                  className="h-11 w-20 text-right"
                  value={nutrientes[clave] ?? ""}
                  placeholder={
                    ingrediente && ingrediente !== "nuevo" ? (calculados.get(ingrediente.id)?.[clave]?.toString().replace(".", ",") ?? "—") : "—"
                  }
                  onChange={(e) => setNutrientes({ ...nutrientes, [clave]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </details>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta={`Stock mínimo (${unidad})`} ayuda="Si baja de aquí, «Completar desde el menú» lo añade a la lista.">
            <Entrada inputMode="decimal" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} placeholder="—" />
          </Campo>
          <Campo etiqueta="Caduca en (días)" ayuda="Valor sugerido al añadir.">
            <Entrada inputMode="numeric" value={caducidadDias} onChange={(e) => setCaducidadDias(e.target.value)} placeholder="—" />
          </Campo>
        </div>
      </div>
    </Hoja>
  );
}
