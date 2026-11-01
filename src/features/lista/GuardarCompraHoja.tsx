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
import { claves, useIngredientes, useProductos } from "../datos";
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

/** Lo marcado como comprado pasa a la despensa (§3.4) y sale de la lista. */
export function GuardarCompraHoja({ items, abierta, onCerrar }: { items: ItemLista[]; abierta: boolean; onCerrar: () => void }) {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: productos = [] } = useProductos();
  const { data: ingredientes = [] } = useIngredientes();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    const porId = new Map(ingredientes.map((i) => [i.id, i]));
    setLineas(
      items.flatMap((item) => {
        const ingrediente = item.ingrediente_id ? porId.get(item.ingrediente_id) : undefined;
        if (!ingrediente || ingrediente.siempre_disponible) return [];
        const delIngrediente = productosDe(productos, ingrediente.id);
        const producto = delIngrediente[0];
        return [
          {
            item,
            ingrediente,
            incluir: Boolean(producto) || puedeCrearGenerico(item, ingrediente),
            producto: producto?.id ?? NUEVO,
            envases: envasesParaCubrir(item.cantidad_base, producto?.cantidad_envase ?? null),
            ubicacion: ubicacionPorSeccion(item.seccion_super),
          },
        ];
      }),
    );
    // Se calcula al abrir; después manda lo que el usuario cambie.
  }, [abierta]);

  const cambiar = (id: string, cambio: Partial<Linea>) => setLineas(lineas.map((l) => (l.item.id === id ? { ...l, ...cambio } : l)));
  const sinDespensa = items.filter((i) => !lineas.some((l) => l.item.id === i.id));
  const aGuardar = lineas.filter((l) => l.incluir);

  async function quitarDeLista() {
    const { error } = await supabase.from("item_lista").delete().in("id", items.map((i) => i.id));
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: claves.lista(hogar.id) });
  }

  async function guardar(conDespensa: boolean) {
    setGuardando(true);
    try {
      if (conDespensa) {
        const hoy = hoyISO();
        for (const l of aGuardar) {
          let producto = productos.find((p) => p.id === l.producto);
          if (!producto) {
            const { data, error } = await supabase
              .from("producto")
              .insert({
                hogar_id: hogar.id,
                ingrediente_id: l.ingrediente.id,
                nombre: l.ingrediente.nombre,
                cantidad_envase: l.ingrediente.unidad_base === "ud" ? 1 : l.item.cantidad_base,
              })
              .select("*, ingrediente:ingrediente(id, nombre, unidad_base, caducidad_defecto_dias)")
              .single();
            if (error) throw error;
            producto = data as ProductoConIngrediente;
          }
          const cantidad = envasesABase(l.envases, producto.cantidad_envase);
          const dias = producto.caducidad_habitual_dias ?? l.ingrediente.caducidad_defecto_dias;
          const { error } = await supabase.from("lote_despensa").insert({
            hogar_id: hogar.id,
            producto_id: producto.id,
            cantidad,
            ubicacion: l.ubicacion,
            fecha_caducidad: dias ? sumarDias(hoy, dias) : null,
          });
          if (error) throw error;
          await supabase.from("movimiento_despensa").insert({ hogar_id: hogar.id, producto_id: producto.id, cantidad, tipo: "alta", motivo: "Compra" });
        }
        queryClient.invalidateQueries({ queryKey: claves.lotes(hogar.id) });
        queryClient.invalidateQueries({ queryKey: claves.productos(hogar.id) });
      }
      await quitarDeLista();
      toast.success(conDespensa && aGuardar.length ? `${aGuardar.length} guardados en la despensa` : `${items.length} quitados de la lista`);
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
          <Boton tamano="lg" onClick={() => guardar(true)} disabled={guardando || !aGuardar.length}>
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
