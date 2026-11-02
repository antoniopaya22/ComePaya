import { Package, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BarraApp } from "@/components/BarraApp";
import { Entrada } from "@/components/ui/campos";
import { ListaEsqueleto, Tarjeta, Vacio } from "@/components/ui/varios";
import { emojiPara } from "@/dominio/ingredientes-base";
import { normalizar } from "@/dominio/texto";
import { formatearCantidad, formatearLote } from "@/dominio/unidades";
import { cn } from "@/lib/utils";
import { useLotes, useProductos } from "../datos";

const COLOR_NUTRISCORE = { a: "#038141", b: "#85bb2f", c: "#fecb02", d: "#ee8100", e: "#e63e11" } as const;

/** Todos los productos del hogar, también los que ahora no hay en casa. */
export function ProductosPage() {
  const { data: productos, isPending } = useProductos();
  const { data: lotes = [] } = useLotes();
  const [busqueda, setBusqueda] = useState("");
  const [soloSinStock, setSoloSinStock] = useState(false);

  const stock = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lotes) m.set(l.producto_id, (m.get(l.producto_id) ?? 0) + l.cantidad);
    return m;
  }, [lotes]);

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return (productos ?? []).filter(
      (p) =>
        (!soloSinStock || !stock.get(p.id)) &&
        (!texto || normalizar(`${p.nombre} ${p.marca ?? ""} ${p.ingrediente.nombre} ${p.ean ?? ""}`).includes(texto)),
    );
  }, [productos, busqueda, soloSinStock, stock]);

  return (
    <>
      <BarraApp titulo="Productos" atras="/despensa" subtitulo={productos ? `${productos.length} conocidos en casa` : undefined} />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, marca o código" className="pl-10" type="search" />
        </div>
        <div className="flex gap-2">
          {[
            { valor: false, etiqueta: "Todos" },
            { valor: true, etiqueta: "Sin existencias" },
          ].map((o) => (
            <button
              key={o.etiqueta}
              onClick={() => setSoloSinStock(o.valor)}
              className={cn("h-9 rounded-full px-4 text-sm font-medium", soloSinStock === o.valor ? "bg-primario text-primario-texto" : "bg-superficie-2 text-suave")}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>

        {isPending ? (
          <ListaEsqueleto />
        ) : !visibles.length ? (
          <Vacio icono={<Package />} titulo={productos?.length ? "Nada coincide" : "Aún no hay productos"}>
            {productos?.length ? null : "Se crean al añadir algo a la despensa o al escanearlo."}
          </Vacio>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {visibles.map((p) => {
              const cantidad = stock.get(p.id) ?? 0;
              return (
                <li key={p.id}>
                  <Link to={`/productos/${p.id}`}>
                    <Tarjeta className="flex items-center gap-3 p-3 transition-colors active:bg-superficie-2">
                      {p.foto_url ? (
                        <img src={p.foto_url} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain" loading="lazy" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-superficie-2 text-2xl">
                          {emojiPara(p.ingrediente.nombre, p.ingrediente.seccion_super, p.ingrediente.emoji)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.nombre}</span>
                        <span className="block truncate text-xs text-suave">
                          {[p.marca, p.cantidad_envase && formatearCantidad(p.cantidad_envase, p.ingrediente.unidad_base)].filter(Boolean).join(" · ")}
                        </span>
                        <span className={cn("block text-xs font-medium", cantidad ? "text-primario" : "text-suave")}>
                          {cantidad ? `En casa: ${formatearLote(cantidad, p.ingrediente.unidad_base, p.cantidad_envase)}` : "No hay"}
                        </span>
                      </span>
                      {p.nutriscore && (
                        <span className="grid size-7 shrink-0 place-items-center rounded-md text-sm font-bold text-white uppercase" style={{ background: COLOR_NUTRISCORE[p.nutriscore] }}>
                          {p.nutriscore}
                        </span>
                      )}
                    </Tarjeta>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
