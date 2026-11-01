import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Clock, Download, Plus, Search, Upload, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";
import { Estrellas } from "@/components/ui/estrellas";
import { Cabecera, Cargando, Etiqueta, Tarjeta, Vacio } from "@/components/ui/varios";
import { normalizar } from "@/dominio/texto";
import { cn } from "@/lib/utils";
import { claves, useIngredientes, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { exportarTodas, importar } from "./markdown";

export function RecetasPage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: recetas, isPending } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const archivo = useRef<HTMLInputElement>(null);
  const [busqueda, setBusqueda] = useState("");
  const [etiqueta, setEtiqueta] = useState<string | null>(null);

  const etiquetas = useMemo(() => [...new Set((recetas ?? []).flatMap((r) => r.etiquetas))].sort((a, b) => a.localeCompare(b, "es")), [recetas]);
  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return (recetas ?? []).filter(
      (r) =>
        (!etiqueta || r.etiquetas.includes(etiqueta)) &&
        (!texto || normalizar(`${r.nombre} ${r.etiquetas.join(" ")} ${r.ingredientes.map((i) => i.ingrediente.nombre).join(" ")}`).includes(texto)),
    );
  }, [recetas, busqueda, etiqueta]);

  return (
    <>
      <Cabecera
        titulo="Recetas"
        subtitulo={recetas ? `${recetas.length} en vuestro recetario` : undefined}
        accion={
          <div className="flex gap-1">
            <Boton variante="fantasma" tamano="icono-sm" aria-label="Importar recetas en Markdown" title="Importar (.md)" onClick={() => archivo.current?.click()}>
              <Upload />
            </Boton>
            {recetas && recetas.length > 0 && (
              <Boton variante="fantasma" tamano="icono-sm" aria-label="Exportar todas en Markdown" title="Exportar todas (.md)" onClick={() => exportarTodas(recetas)}>
                <Download />
              </Boton>
            )}
            <Boton asChild tamano="sm">
              <Link to="/recetas/nueva">
                <Plus /> Nueva
              </Link>
            </Boton>
          </div>
        }
      />
      <input
        ref={archivo}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        multiple
        hidden
        onChange={async (e) => {
          const archivos = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!archivos.length) return;
          const textos = await Promise.all(archivos.map((a) => a.text()));
          const r = await importar(hogar.id, textos, ingredientes, (recetas ?? []).map((x) => x.nombre));
          queryClient.invalidateQueries({ queryKey: claves.recetas(hogar.id) });
          queryClient.invalidateQueries({ queryKey: claves.ingredientes(hogar.id) });
          if (r.importadas.length) toast.success(`${r.importadas.length} recetas importadas`);
          if (r.saltadas.length) toast.info(`Ya existían: ${r.saltadas.join(", ")}`);
          if (r.errores.length) toast.error(r.errores.join(" · "));
        }}
      />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o ingrediente" className="pl-10" type="search" />
        </div>

        {etiquetas.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {etiquetas.map((e) => (
              <button
                key={e}
                onClick={() => setEtiqueta(etiqueta === e ? null : e)}
                className={cn("h-8 shrink-0 rounded-full px-3.5 text-sm font-medium", etiqueta === e ? "bg-primario text-primario-texto" : "bg-superficie-2 text-suave")}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {isPending ? (
          <Cargando />
        ) : !recetas?.length ? (
          <Vacio icono={<BookOpen />} titulo="Aún no hay recetas">
            Crea vuestros platos habituales con sus ingredientes y cantidades: el menú y la lista de la compra salen de aquí.
          </Vacio>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {visibles.map((r) => {
              const minutos = (r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0);
              return (
                <li key={r.id}>
                  <Link to={`/recetas/${r.id}`}>
                    <Tarjeta className="flex h-full flex-col gap-2 p-4 transition-colors active:bg-superficie-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="leading-snug font-semibold">{r.nombre}</p>
                        {r.valoracion && <Estrellas valor={r.valoracion} />}
                      </div>
                      <p className="flex items-center gap-3 text-sm text-suave">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" /> {r.raciones}
                        </span>
                        {minutos > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" /> {minutos} min
                          </span>
                        )}
                        <span>{r.ingredientes.length} ingredientes</span>
                      </p>
                      {r.etiquetas.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.etiquetas.map((e) => (
                            <Etiqueta key={e}>{e}</Etiqueta>
                          ))}
                        </div>
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
