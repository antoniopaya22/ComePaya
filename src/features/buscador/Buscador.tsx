import * as Dialogo from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Carrot,
  CornerDownLeft,
  House,
  ListChecks,
  Package,
  Plus,
  Refrigerator,
  ScanBarcode,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { emojiPara } from "@/dominio/ingredientes-base";
import { puntuarBusqueda } from "@/dominio/texto";
import { useIngredientes, useLotes, useProductos, useRecetas } from "../datos";
import { useAnadirALista } from "../lista/useAnadirALista";

interface Pantalla {
  ruta: string;
  nombre: string;
  icono: LucideIcon;
  claves?: string[];
}

const PANTALLAS: Pantalla[] = [
  { ruta: "/", nombre: "Hoy", icono: House, claves: ["inicio", "resumen"] },
  { ruta: "/menu", nombre: "Menú de la semana", icono: CalendarDays, claves: ["planificar", "comidas", "cenas"] },
  { ruta: "/lista", nombre: "Lista de la compra", icono: ListChecks, claves: ["super", "comprar"] },
  { ruta: "/despensa", nombre: "Despensa", icono: Refrigerator, claves: ["nevera", "congelador", "caducidad", "stock"] },
  { ruta: "/recetas", nombre: "Recetas", icono: BookOpen, claves: ["platos", "cocinar"] },
  { ruta: "/productos", nombre: "Productos", icono: Package, claves: ["catalogo", "marcas"] },
  { ruta: "/ajustes/ingredientes", nombre: "Ingredientes", icono: Carrot, claves: ["unidades", "nutrientes", "alergenos"] },
  { ruta: "/ajustes/estadisticas", nombre: "Estadísticas", icono: BarChart3, claves: ["desperdicio", "gasto", "resumen"] },
  { ruta: "/ajustes", nombre: "Ajustes", icono: Settings, claves: ["hogar", "familia", "avisos", "cuenta", "tiendas"] },
];

const POR_GRUPO = 5;

/** Los `n` mejores por puntuación, descartando los que no coinciden. */
function mejores<T>(lista: T[], puntuar: (x: T) => number, n = POR_GRUPO): T[] {
  return lista
    .map((x) => [x, puntuar(x)] as const)
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([x]) => x);
}

/** Ctrl+K / ⌘K abre el buscador desde cualquier pantalla. */
export function useAtajoBuscar(abrir: () => void) {
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        abrir();
      }
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abrir]);
}

export const ATAJO_BUSCAR = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

/** Buscador global: recetas, productos, ingredientes, pantallas y acciones rápidas. */
export function Buscador({ abierto, onCambiar }: { abierto: boolean; onCambiar: (abierto: boolean) => void }) {
  const [consulta, setConsulta] = useState("");
  const navigate = useNavigate();
  const anadirALista = useAnadirALista();
  const { data: recetas = [] } = useRecetas();
  const { data: productos = [] } = useProductos();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: lotes = [] } = useLotes();

  const enCasa = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const l of lotes) cuenta.set(l.producto_id, (cuenta.get(l.producto_id) ?? 0) + 1);
    return cuenta;
  }, [lotes]);

  const q = consulta.trim();
  const resultados = useMemo(
    () => ({
      pantallas: q ? mejores(PANTALLAS, (p) => puntuarBusqueda(p.nombre, q, p.claves)) : PANTALLAS.slice(0, 6),
      recetas: q ? mejores(recetas, (r) => puntuarBusqueda(r.nombre, q, r.etiquetas)) : [],
      productos: q ? mejores(productos, (p) => puntuarBusqueda(p.nombre, q, [p.marca ?? "", p.ingrediente?.nombre ?? ""])) : [],
      ingredientes: q ? mejores(ingredientes, (i) => puntuarBusqueda(i.nombre, q)) : [],
    }),
    [q, recetas, productos, ingredientes],
  );

  function cerrar() {
    onCambiar(false);
    setConsulta("");
  }

  function ir(ruta: string) {
    cerrar();
    navigate(ruta);
  }

  function anadir() {
    const texto = anadirALista(q);
    cerrar();
    if (texto) toast.success(`${texto} añadido a la lista`, { action: { label: "Ver lista", onClick: () => navigate("/lista") } });
  }

  const hayResultados = resultados.recetas.length + resultados.productos.length + resultados.ingredientes.length > 0;
  const grupoAnadir = (
    <Grupo titulo="Acciones">
      <Opcion valor="accion-lista" onSelect={anadir} icono={<ListChecks />}>
        Añadir <b className="font-semibold">«{q}»</b> a la lista
      </Opcion>
    </Grupo>
  );

  return (
    <Dialogo.Root open={abierto} onOpenChange={(v) => (v ? onCambiar(true) : cerrar())}>
      <Dialogo.Portal>
        <Dialogo.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-[aparecer_150ms_ease-out]" />
        <Dialogo.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-3 z-50 mx-auto max-w-xl overflow-hidden rounded-3xl border border-borde bg-superficie shadow-2xl shadow-black/20 data-[state=open]:animate-[aparecer_150ms_ease-out] sm:top-[12vh]"
        >
          <Dialogo.Title className="sr-only">Buscar</Dialogo.Title>
          <Command shouldFilter={false} loop label="Buscar en ComePayá">
            <div className="flex items-center gap-3 border-b border-borde px-4">
              <Search className="size-5 shrink-0 text-suave" />
              <Command.Input
                value={consulta}
                onValueChange={setConsulta}
                placeholder="Busca recetas, productos, ingredientes…"
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-suave"
              />
              <kbd className="hidden rounded-md border border-borde px-1.5 py-0.5 text-[11px] text-suave sm:block">Esc</kbd>
            </div>

            <Command.List className="max-h-[min(60dvh,460px)] overflow-y-auto overscroll-contain p-2">
              {/* Sin resultados, lo primero (y lo que hace ↵) es añadirlo a la lista; con resultados va al final. */}
              {q && !hayResultados && grupoAnadir}

              {resultados.recetas.length > 0 && (
                <Grupo titulo="Recetas">
                  {resultados.recetas.map((r) => {
                    const minutos = (r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0);
                    return (
                      <Opcion
                        key={r.id}
                        valor={`receta-${r.id}`}
                        onSelect={() => ir(`/recetas/${r.id}`)}
                        icono={
                          r.foto_url ? <img src={r.foto_url} alt="" className="size-full rounded-lg object-cover" /> : <span className="text-lg">🍲</span>
                        }
                        detalle={[minutos ? `${minutos} min` : "", ...r.etiquetas.slice(0, 2)].filter(Boolean).join(" · ")}
                      >
                        {r.nombre}
                      </Opcion>
                    );
                  })}
                </Grupo>
              )}

              {resultados.productos.length > 0 && (
                <Grupo titulo="Productos">
                  {resultados.productos.map((p) => {
                    const n = enCasa.get(p.id) ?? 0;
                    return (
                      <Opcion
                        key={p.id}
                        valor={`producto-${p.id}`}
                        onSelect={() => ir(`/productos/${p.id}`)}
                        icono={<span className="text-lg">{emojiPara(p.ingrediente?.nombre ?? p.nombre, p.ingrediente?.seccion_super ?? null, p.ingrediente?.emoji)}</span>}
                        detalle={[p.marca, n ? `${n} en casa` : "No hay en casa"].filter(Boolean).join(" · ")}
                      >
                        {p.nombre}
                      </Opcion>
                    );
                  })}
                </Grupo>
              )}

              {resultados.ingredientes.length > 0 && (
                <Grupo titulo="Ingredientes">
                  {resultados.ingredientes.map((i) => (
                    <Opcion
                      key={i.id}
                      valor={`ingrediente-${i.id}`}
                      onSelect={() => ir(`/ingredientes/${i.id}`)}
                      icono={<span className="text-lg">{emojiPara(i.nombre, i.seccion_super, i.emoji)}</span>}
                      detalle={i.seccion_super}
                    >
                      {i.nombre}
                    </Opcion>
                  ))}
                </Grupo>
              )}

              {q && hayResultados && grupoAnadir}

              {resultados.pantallas.length > 0 && (
                <Grupo titulo={q ? "Pantallas" : "Ir a"}>
                  {resultados.pantallas.map(({ ruta, nombre, icono: Icono }) => (
                    <Opcion key={ruta} valor={`pantalla-${ruta}`} onSelect={() => ir(ruta)} icono={<Icono />}>
                      {nombre}
                    </Opcion>
                  ))}
                </Grupo>
              )}

              {!q && (
                <Grupo titulo="Acciones">
                  <Opcion valor="accion-escanear" onSelect={() => ir("/escanear")} icono={<ScanBarcode />}>
                    Escanear un producto
                  </Opcion>
                  <Opcion valor="accion-receta" onSelect={() => ir("/recetas/nueva")} icono={<Plus />}>
                    Nueva receta
                  </Opcion>
                </Grupo>
              )}
            </Command.List>

            <div className="hidden items-center gap-4 border-t border-borde px-4 py-2.5 text-xs text-suave sm:flex">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-borde px-1">↑</kbd>
                <kbd className="rounded border border-borde px-1">↓</kbd> moverse
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-borde px-1">
                  <CornerDownLeft className="inline size-3" />
                </kbd>
                abrir
              </span>
              <span className="ml-auto">Lo que no encuentres, puedes añadirlo a la lista</span>
            </div>
          </Command>
        </Dialogo.Content>
      </Dialogo.Portal>
    </Dialogo.Root>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={titulo}
      className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-suave"
    >
      {children}
    </Command.Group>
  );
}

function Opcion({
  valor,
  onSelect,
  icono,
  detalle,
  children,
}: {
  valor: string;
  onSelect: () => void;
  icono: ReactNode;
  detalle?: string | null;
  children: ReactNode;
}) {
  return (
    <Command.Item
      value={valor}
      onSelect={onSelect}
      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 data-[selected=true]:bg-superficie-2"
    >
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-superficie-2 text-suave [&_svg]:size-[18px]">{icono}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{children}</span>
        {detalle && <span className="block truncate text-xs text-suave first-letter:uppercase">{detalle}</span>}
      </span>
    </Command.Item>
  );
}
