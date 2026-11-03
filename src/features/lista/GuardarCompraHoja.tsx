import { useQueryClient } from "@tanstack/react-query";
import { Refrigerator, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Contador, Selector } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import { hoyISO, sumarDias } from "@/dominio/caducidad";
import { envasesParaCubrir, ubicacionPorSeccion } from "@/dominio/compra";
import { envasesABase, formatearCantidad } from "@/dominio/unidades";
import { supabase } from "@/lib/supabase";
import { UBICACIONES, type Ingrediente, type ItemLista, type ProductoConIngrediente, type Ubicacion } from "@/lib/tipos";
import { cn, mensajeError } from "@/lib/utils";
import { claves, useIngredientes, useLotes, useProductos } from "../datos";
import type { CambiosDespensa } from "../despensa/cambios";
import { aplicarConDeshacer, avisarConDeshacer, deshacerDespensa } from "../despensa/deshacer";
import { SELECT_PRODUCTO } from "../despensa/altas";
import { useHogar } from "../hogar/HogarProvider";

const NUEVO = "nuevo";

interface Linea {
  item: ItemLista;
  ingrediente: Ingrediente;
  incluir: boolean;
  /** id de producto, o NUEVO para crear uno genérico con el nombre del ingrediente. */
  producto: string;
  envases: number;
  ubicacion: Ubicacion;
}

/** Lo marcado como comprado pasa a la despensa (§3.4) y sale de la lista. Se puede deshacer. */
export function GuardarCompraHoja({ items: marcados, abierta, onCerrar }: { items: ItemLista[]; abierta: boolean; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: productos = [] } = useProductos();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: lotes = [] } = useLotes();
  const [lineas, setLineas] = useState<Linea[]>([]);
  // Lo marcado al abrir: si otro móvil marca o desmarca algo mientras tanto, se guarda lo que se ve aquí.
  const [items, setItems] = useState<ItemLista[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    const items = marcados;
    setItems(items);
    const porId = new Map(ingredientes.map((i) => [i.id, i]));
    setLineas(
      items.flatMap((item) => {
        const ingrediente = item.ingrediente_id ? porId.get(item.ingrediente_id) : undefined;
        if (!ingrediente || ingrediente.siempre_disponible) return [];
        const producto = productosDe(productos, ingrediente.id)[0];
        const eleccion = producto?.id ?? NUEVO;
        return [
          {
            item,
            ingrediente,
            incluir: Boolean(producto) || puedeCrearGenerico(item, ingrediente),
            producto: eleccion,
            envases: envasesParaCubrir(item.cantidad_base, envaseDe(eleccion, item, ingrediente)),
            ubicacion: ubicacionPorSeccion(item.seccion_super),
          },
        ];
      }),
    );
    // Se calcula al abrir; después manda lo que el usuario cambie.
  }, [abierta]);

  /** Contenido de un envase según lo elegido: el del producto, o para uno genérico, 1 ud o la cantidad de la lista. */
  function envaseDe(eleccion: string, item: ItemLista, ingrediente: Ingrediente): number | null {
    if (eleccion === NUEVO) return ingrediente.unidad_base === "ud" ? 1 : item.cantidad_base;
    return productos.find((p) => p.id === eleccion)?.cantidad_envase ?? 1;
  }

  const cambiar = (id: string, cambio: Partial<Linea>) =>
    setLineas((previas) =>
      previas.map((l) => {
        if (l.item.id !== id) return l;
        const nueva = { ...l, ...cambio };
        // Al cambiar de producto se recalculan los envases para cubrir lo que pedía la lista.
        if (cambio.producto && cambio.producto !== l.producto) nueva.envases = envasesParaCubrir(l.item.cantidad_base, envaseDe(cambio.producto, l.item, l.ingrediente));
        return nueva;
      }),
    );
  const sinDespensa = items.filter((i) => !lineas.some((l) => l.item.id === i.id));
  const aGuardar = lineas.filter((l) => l.incluir);

  async function guardar(conDespensa: boolean) {
    setGuardando(true);
    try {
      const cambios: CambiosDespensa = { items_borrar: items.map((i) => i.id), lotes_crear: [], movimientos: [] };
      if (conDespensa) {
        const hoy = hoyISO();
        for (const l of aGuardar) {
          let producto = productos.find((p) => p.id === l.producto);
          if (!producto) {
            // Producto genérico: se crea una vez y se recuerda en la línea, para no duplicarlo si hay que reintentar.
            const { data, error } = await supabase
              .from("producto")
              .insert({
                hogar_id: hogar.id,
                ingrediente_id: l.ingrediente.id,
                nombre: l.ingrediente.nombre,
                cantidad_envase: envaseDe(NUEVO, l.item, l.ingrediente),
              })
              .select(SELECT_PRODUCTO)
              .single();
            if (error) throw error;
            producto = data as ProductoConIngrediente;
            queryClient.setQueryData<ProductoConIngrediente[]>(claves.productos(hogar.id), (lista) => [...(lista ?? []), producto!]);
            cambiar(l.item.id, { producto: producto.id });
          }
          const cantidad = envasesABase(l.envases, producto.cantidad_envase);
          const dias = producto.caducidad_habitual_dias ?? l.ingrediente.caducidad_defecto_dias;
          cambios.lotes_crear!.push({ producto_id: producto.id, cantidad, ubicacion: l.ubicacion, fecha_caducidad: dias ? sumarDias(hoy, dias) : null });
          cambios.movimientos!.push({ producto_id: producto.id, cantidad, tipo: "alta", motivo: "Compra" });
        }
      }
      // Lotes, movimientos y quitar de la lista, todo o nada: un reintento (o el otro móvil) no duplica la compra.
      const antes = await aplicarConDeshacer(hogar.id, cambios, lotes);
      for (const clave of [claves.lotes, claves.productos, claves.lista]) queryClient.invalidateQueries({ queryKey: clave(hogar.id) });
      const quitados = items.map((i) => ({ ...i }));
      avisarConDeshacer(
        queryClient,
        hogar.id,
        conDespensa && aGuardar.length ? `${aGuardar.length} guardados en la despensa` : `${items.length} quitados de la lista`,
        async () => {
          await deshacerDespensa(hogar.id, antes);
          // Vuelven a la lista tal cual estaban (marcados), salvo los que alguien ya haya vuelto a añadir.
          const { error } = await supabase.from("item_lista").upsert(quitados, { onConflict: "id", ignoreDuplicates: true });
          if (error) throw error;
        },
      );
      onCerrar();
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Hoja
      abierta={abierta}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo="Guardar la compra"
      descripcion="Lo marcado pasa a la despensa y sale de la lista. La caducidad se toma de la habitual de cada producto."
      pie={
        <div className="flex flex-col gap-2">
          <Boton
            tamano="lg"
            onClick={() => (aGuardar.length ? guardar(true) : toast.error("No hay nada marcado para la despensa: marca alguno arriba o usa «Solo quitar de la lista»"))}
            disabled={guardando}
          >
            <Refrigerator /> Guardar {aGuardar.length} en la despensa
          </Boton>
          <Boton variante="fantasma" onClick={() => guardar(false)} disabled={guardando}>
            <Trash2 /> Solo quitar de la lista
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {lineas.map((l) => {
          const opciones = productosDe(productos, l.ingrediente.id);
          const generico = l.producto === NUEVO;
          const posible = !generico || puedeCrearGenerico(l.item, l.ingrediente);
          return (
            <div key={l.item.id} className={cn("flex flex-col gap-2 rounded-2xl border border-borde p-3", !l.incluir && "opacity-55")}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={l.incluir}
                  disabled={!posible}
                  onChange={(e) => cambiar(l.item.id, { incluir: e.target.checked })}
                  className="size-5 accent-[var(--primario)]"
                />
                <span className="flex-1 font-medium">{l.item.texto}</span>
                {l.item.cantidad && <span className="text-sm text-suave">{l.item.cantidad}</span>}
              </label>
              {posible ? (
                l.incluir && (
                  <>
                    <Selector value={l.producto} onChange={(e) => cambiar(l.item.id, { producto: e.target.value })} className="h-10 text-sm">
                      {opciones.map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.nombre, p.marca, p.cantidad_envase && formatearCantidad(p.cantidad_envase, l.ingrediente.unidad_base)].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                      {puedeCrearGenerico(l.item, l.ingrediente) && <option value={NUEVO}>Nuevo: {l.ingrediente.nombre} (genérico)</option>}
                    </Selector>
                    <div className="grid grid-cols-2 gap-2">
                      <Contador valor={l.envases} onChange={(v) => cambiar(l.item.id, { envases: Math.max(0.5, v) })} min={0.5} />
                      <Selector value={l.ubicacion} onChange={(e) => cambiar(l.item.id, { ubicacion: e.target.value as Ubicacion })} className="h-12 text-sm">
                        {UBICACIONES.map((u) => (
                          <option key={u.valor} value={u.valor}>
                            {u.etiqueta}
                          </option>
                        ))}
                      </Selector>
                    </div>
                  </>
                )
              ) : (
                <p className="text-xs text-suave">No hay producto para este ingrediente ni cantidad para crearlo: añádelo desde Despensa.</p>
              )}
            </div>
          );
        })}
        {sinDespensa.length > 0 && (
          <p className="text-sm text-suave">
            Solo se quitarán de la lista: {sinDespensa.map((i) => i.texto).join(", ")} (texto libre o básicos).
          </p>
        )}
      </div>
    </Hoja>
  );
}

function productosDe(productos: ProductoConIngrediente[], ingredienteId: string) {
  return productos.filter((p) => p.ingrediente_id === ingredienteId).sort((a, b) => b.creado_en.localeCompare(a.creado_en));
}

/** Un producto genérico necesita saber cuánto trae: en unidades vale 1; en g/ml, la cantidad de la lista. */
function puedeCrearGenerico(item: ItemLista, ingrediente: Ingrediente) {
  return ingrediente.unidad_base === "ud" || Boolean(item.cantidad_base);
}
