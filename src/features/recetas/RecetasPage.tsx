import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Clock, Download, Globe, Plus, Search, Upload, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";
import { Estrellas } from "@/components/ui/estrellas";
import { Cabecera, Etiqueta, ListaEsqueleto, Tarjeta, Vacio } from "@/components/ui/varios";
import { emojiPara } from "@/dominio/ingredientes-base";
import { normalizar } from "@/dominio/texto";
import type { RecetaCompleta } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { claves, useIngredientes, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { ImportarRecetaHoja } from "./ImportarRecetaHoja";
import { exportarTodas, importar } from "./markdown";

export function RecetasPage() {
  const { hogar } = useHogar();
  const queryClient = useQueryClient();
  const { data: recetas, isPending } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const archivo = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const emojiIngrediente = useMemo(() => new Map(ingredientes.map((i) => [i.id, emojiPara(i.nombre, i.seccion_super, i.emoji)])), [ingredientes]);
  /** Sin foto, el icono del ingrediente principal (el de más cantidad que no sea básico). */
  const platoEmoji = (r: RecetaCompleta) => {
    const principal = [...r.ingredientes].filter((i) => !i.opcional).sort((a, b) => b.cantidad - a.cantidad)[0];
    return (principal && emojiIngrediente.get(principal.ingrediente_id)) ?? "🍽️";
  };
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
            <Boton variante="fantasma" tamano="icono-sm" aria-label="Importar desde una web" title="Importar desde una web" onClick={() => setImportando(true)}>
              <Globe />
            </Boton>
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
          <ListaEsqueleto />
        ) : !recetas?.length ? (
          <Vacio icono={<BookOpen />} titulo="Aún no hay recetas">
            Crea vuestros platos habituales o impórtalos desde vuestras webs de cocina favoritas: el menú y la lista de la compra salen de aquí.
            <Boton variante="secundario" className="mt-4" onClick={() => setImportando(true)}>
              <Globe /> Importar desde una web
            </Boton>
          </Vacio>
        ) : (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {visibles.map((r) => {
              const minutos = (r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0);
              return (
                <li key={r.id}>
                  <Link to={`/recetas/${r.id}`}>
                    <Tarjeta className="flex h-full flex-col overflow-hidden transition-transform active:scale-[0.98]">
                      <div className="relative aspect-[4/3] bg-superficie-2">
                        {r.foto_url ? (
                          <img src={r.foto_url} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <span className="grid size-full place-items-center text-4xl opacity-80">{platoEmoji(r)}</span>
                        )}
                        {r.valoracion && (
                          <span className="absolute top-2 right-2 rounded-full bg-black/55 px-1.5 py-0.5 backdrop-blur">
                            <Estrellas valor={r.valoracion} />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-3">
                        <p className="font-titulo leading-snug font-semibold">{r.nombre}</p>
                        <p className="mt-auto flex items-center gap-3 text-xs text-suave">
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" /> {r.raciones}
                          </span>
                          {minutos > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" /> {minutos} min
                            </span>
                          )}
                        </p>
                        {r.etiquetas.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.etiquetas.slice(0, 2).map((e) => (
                              <Etiqueta key={e}>{e}</Etiqueta>
                            ))}
                          </div>
                        )}
                      </div>
                    </Tarjeta>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ImportarRecetaHoja abierta={importando} onCerrar={() => setImportando(false)} />
    </>
  );
}
