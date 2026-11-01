import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campos";
import { useConfirmar } from "@/components/ui/confirmar";
import { Hoja } from "@/components/ui/hoja";
import { Esqueleto, Etiqueta, Tarjeta, Vacio } from "@/components/ui/varios";
import { describirCaducidad, estadoCaducidad, hoyISO } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { buscarIngrediente } from "@/dominio/lista";
import { formatearCantidad, formatearLote } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import { UBICACIONES, type LoteConProducto, type ProductoConIngrediente } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { claves, useIngredientes, useLotes, useProductos } from "../datos";
import { NuevoLoteHoja } from "../despensa/NuevoLoteHoja";
import { RetirarLoteHoja } from "../despensa/RetirarLoteHoja";
import { FichaProducto, productoAExterno } from "../escaner/FichaProducto";
import { useHogar } from "../hogar/HogarProvider";

const TEXTO_MOVIMIENTO = { alta: "Entrada", consumo: "Consumido", tirado: "Tirado", ajuste: "Ajuste" } as const;

/** Ficha de producto: qué es, cuánto hay, su salud y su historial. */
export function ProductoPage() {
  const { id } = useParams();
  const { hogar } = useHogar();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmar = useConfirmar();
  const { data: productos, isPending } = useProductos();
  const { data: lotes = [] } = useLotes();
  const producto = productos?.find((p) => p.id === id);
  const [lote, setLote] = useState<LoteConProducto | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const hoy = hoyISO();

  const { data: movimientos = [] } = useQuery({
    queryKey: ["movimientos", hogar.id, "producto", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimiento_despensa")
        .select("id, cantidad, tipo, motivo, creado_en")
        .eq("producto_id", id!)
        .order("creado_en", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data as { id: string; cantidad: number; tipo: keyof typeof TEXTO_MOVIMIENTO; motivo: string | null; creado_en: string }[];
    },
  });

  if (isPending) return <FichaEsqueleto />;
  if (!producto) return <Vacio icono={<ArrowLeft />} titulo="Este producto ya no existe" />;

  const suyos = lotes.filter((l) => l.producto_id === producto.id);
  const total = suyos.reduce((t, l) => t + l.cantidad, 0);
  const unidad = producto.ingrediente.unidad_base;
  const conSalud = Boolean(producto.nutriscore || producto.nova || producto.nutrientes_100 || producto.aditivos?.length);

  async function borrar() {
    const ok = await confirmar({
      titulo: `¿Borrar «${producto!.nombre}»?`,
      mensaje: suyos.length ? `Se borrarán también sus ${suyos.length} lotes de la despensa y su historial.` : "Se borrará también su historial.",
      aceptar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("producto").delete().eq("id", producto!.id);
    if (error) return toast.error(mensajeError(error));
    queryClient.invalidateQueries({ queryKey: claves.productos(hogar.id) });
    queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });
    navigate(-1);
  }

  return (
    <article className="flex flex-col gap-5 px-4 pt-4 md:px-0">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-suave">
          <ArrowLeft className="size-4" /> Volver
        </button>
        <div className="flex gap-1">
          <Boton variante="fantasma" tamano="icono-sm" aria-label="Borrar producto" onClick={borrar}>
            <Trash2 />
          </Boton>
          <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}>
            <Pencil /> Editar
          </Boton>
        </div>
      </div>

      <header className="flex items-center gap-4">
        {producto.foto_url ? (
          <img src={producto.foto_url} alt="" className="size-24 shrink-0 rounded-3xl bg-white object-contain p-1.5 shadow-sm" />
        ) : (
          <div className="grid size-24 shrink-0 place-items-center rounded-3xl bg-superficie-2 text-5xl">
            {emojiPara(producto.ingrediente.nombre, producto.ingrediente.seccion_super, producto.ingrediente.emoji)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-titulo text-[26px] leading-tight font-semibold">{producto.nombre}</h1>
          <p className="text-sm text-suave">{[producto.marca, producto.cantidad_envase && formatearCantidad(producto.cantidad_envase, unidad)].filter(Boolean).join(" · ")}</p>
          <Link to={`/ingredientes/${producto.ingrediente.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primario">
            {producto.ingrediente.nombre} <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            En casa{" "}
            <span className="font-normal text-suave">{total ? formatearLote(total, unidad, producto.cantidad_envase) : "· nada"}</span>
          </h2>
          <Boton variante="secundario" tamano="sm" onClick={() => setAnadiendo(true)}>
            <Plus /> Añadir
          </Boton>
        </div>
        {suyos.length > 0 && (
          <Tarjeta className="divide-y divide-borde">
            {suyos.map((l) => {
              const estado = estadoCaducidad(l.fecha_caducidad, hoy);
              return (
                <button key={l.id} onClick={() => setLote(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-superficie-2">
                  <span className="flex-1">
                    <span className="block font-medium">{formatearLote(l.cantidad, unidad, producto.cantidad_envase)}</span>
                    <span className="block text-xs text-suave">{UBICACIONES.find((u) => u.valor === l.ubicacion)?.etiqueta}</span>
                  </span>
                  <Etiqueta tono={estado === "caducado" ? "peligro" : estado === "pronto" ? "aviso" : "neutro"}>{describirCaducidad(l.fecha_caducidad, hoy)}</Etiqueta>
                </button>
              );
            })}
          </Tarjeta>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Salud</h2>
        {conSalud ? (
          <Tarjeta className="p-4">
            <FichaProducto producto={productoAExterno(producto)} />
          </Tarjeta>
        ) : (
          <p className="text-sm text-suave">Sin datos. Si tiene código de barras, escanéalo para traer su información de Open Food Facts.</p>
        )}
      </section>

      {movimientos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-4 text-suave" /> Historial
          </h2>
          <Tarjeta className="divide-y divide-borde">
            {movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  {TEXTO_MOVIMIENTO[m.tipo]}
                  {m.motivo && <span className="text-suave"> · {m.motivo}</span>}
                </span>
                <span className="text-suave">
                  {formatearCantidad(Math.abs(m.cantidad), unidad)} · {new Date(m.creado_en).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </Tarjeta>
        </section>
      )}

      <RetirarLoteHoja lote={lote} onCerrar={() => setLote(null)} />
      <NuevoLoteHoja abierta={anadiendo} onAbiertaChange={setAnadiendo} productoInicial={producto} />
      <EditarProductoHoja producto={editando ? producto : null} onCerrar={() => setEditando(false)} />
    </article>
  );
}

function EditarProductoHoja({ producto, onCerrar }: { producto: ProductoConIngrediente | null; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: ingredientes = [] } = useIngredientes();
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [envase, setEnvase] = useState("");
  const [ingrediente, setIngrediente] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  if (producto && abierto !== producto.id) {
    setAbierto(producto.id);
    setNombre(producto.nombre);
    setMarca(producto.marca ?? "");
    setEnvase(producto.cantidad_envase?.toString().replace(".", ",") ?? "");
    setIngrediente(producto.ingrediente.nombre);
  }

  const destino = buscarIngrediente(ingrediente, ingredientes);

  async function guardar() {
    if (!producto || !destino) return;
    const { error } = await supabase
      .from("producto")
      .update({
        nombre: nombre.trim(),
        marca: marca.trim() || null,
        cantidad_envase: Number(envase.replace(",", ".")) || null,
        ingrediente_id: destino.id,
      })
      .eq("id", producto.id);
    if (error) return toast.error(mensajeError(error));
    queryClient.invalidateQueries({ queryKey: claves.productos(hogar.id) });
    queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });
    setAbierto(null);
    onCerrar();
  }

  return (
    <Hoja
      abierta={producto !== null}
      onAbiertaChange={(v) => {
        if (!v) {
          setAbierto(null);
          onCerrar();
        }
      }}
      titulo="Editar producto"
      pie={
        <Boton className="w-full" onClick={guardar} disabled={!nombre.trim() || !destino}>
          Guardar
        </Boton>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Marca">
          <Entrada value={marca} onChange={(e) => setMarca(e.target.value)} />
        </Campo>
        <Campo etiqueta={`Contenido del envase (${destino?.unidad_base ?? producto?.ingrediente.unidad_base})`} ayuda="Cambiarlo no recalcula los lotes que ya hay.">
          <Entrada inputMode="decimal" value={envase} onChange={(e) => setEnvase(e.target.value)} />
        </Campo>
        <Campo etiqueta="Ingrediente" ayuda={destino ? undefined : "Elige un ingrediente que exista (Ajustes → Ingredientes)."}>
          <Entrada list="producto-ingredientes" value={ingrediente} onChange={(e) => setIngrediente(e.target.value)} />
          <datalist id="producto-ingredientes">
            {ingredientes.map((i) => (
              <option key={i.id} value={i.nombre} />
            ))}
          </datalist>
        </Campo>
      </div>
    </Hoja>
  );
}

export function FichaEsqueleto() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-12 md:px-0" aria-busy="true">
      <div className="flex items-center gap-4">
        <Esqueleto className="size-24 rounded-3xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Esqueleto className="h-6 w-3/4" />
          <Esqueleto className="h-4 w-1/2" />
        </div>
      </div>
      <Esqueleto className="h-32 w-full rounded-2xl" />
      <Esqueleto className="h-48 w-full rounded-2xl" />
    </div>
  );
}
