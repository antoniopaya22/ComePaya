import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Link, useNavigate, type LinkProps } from "react-router";
import { useAbrirBuscador } from "@/features/buscador/Buscador";
import { cn } from "@/lib/utils";

/**
 * Cabecera de cada pantalla.
 * Móvil: barra de app fija arriba (volver, título y acciones). Con `grande`, el título se muestra
 * grande bajo la barra y pasa a la barra al desplazar, como en las apps nativas.
 * Escritorio: cabecera de página clásica; la barra superior global ya tiene buscador y cuenta.
 */
export function BarraApp({
  titulo,
  subtitulo,
  atras,
  acciones,
  principal,
  buscar = false,
  grande = true,
  inicio,
  escritorio = true,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  /** Muestra la flecha de volver; la ruta es a dónde ir si no hay historial (se abrió con un enlace). */
  atras?: string;
  /** Botones de icono (BotonBarra) a la derecha, en móvil y escritorio. */
  acciones?: ReactNode;
  /** Acción principal con texto: solo en escritorio (en el móvil va en un botón flotante o en la pantalla). */
  principal?: ReactNode;
  /** Añade la lupa del buscador global en la barra del móvil. */
  buscar?: boolean;
  grande?: boolean;
  /** Sustituye al título compacto en la barra del móvil (por ejemplo, el logo en Hoy). */
  inicio?: ReactNode;
  /** Con false no pinta la cabecera de escritorio (la pantalla tiene la suya). */
  escritorio?: boolean;
  /** Contenido bajo el título grande (en ambos tamaños), como filtros o un aviso. */
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const abrirBuscador = useAbrirBuscador();
  const tituloGrande = useRef<HTMLDivElement>(null);
  const [desplazado, setDesplazado] = useState(!grande);

  useEffect(() => {
    const el = tituloGrande.current;
    if (!grande || !el) return;
    // El título grande desaparece bajo la barra (56 px + zona segura): pasa a la barra.
    const observador = new IntersectionObserver(([e]) => setDesplazado(!e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    observador.observe(el);
    return () => observador.disconnect();
  }, [grande]);

  function volver() {
    // Con historial propio se vuelve atrás (conserva el desplazamiento); si no, a la pantalla madre.
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1);
    else navigate(atras ?? "/");
  }

  const tituloCompacto = inicio ?? (
    <span className={cn("min-w-0 truncate text-[17px] font-semibold transition-opacity duration-200", desplazado ? "opacity-100" : "opacity-0")}>
      {titulo}
    </span>
  );

  return (
    <>
      {/* Móvil */}
      <div
        className={cn(
          "pt-seguro sticky top-0 z-30 border-b bg-fondo/85 backdrop-blur-xl transition-colors md:hidden",
          desplazado ? "border-borde/70" : "border-transparent",
        )}
      >
        <div className={cn("flex h-14 items-center gap-1 px-1.5", !atras && "pl-4")}>
          {atras && (
            <BotonBarra etiqueta="Volver" onClick={volver}>
              <ArrowLeft />
            </BotonBarra>
          )}
          {grande ? (
            <div aria-hidden={!inicio}>{tituloCompacto}</div>
          ) : (
            (inicio ?? <h1 className="min-w-0 truncate font-sans text-[17px] font-semibold tracking-normal">{titulo}</h1>)
          )}
          <div className="ml-auto flex shrink-0 items-center">
            {buscar && (
              <BotonBarra etiqueta="Buscar" onClick={abrirBuscador} data-recorrido="buscar">
                <Search />
              </BotonBarra>
            )}
            {acciones}
          </div>
        </div>
      </div>
      {grande && (
        <div ref={tituloGrande} className="px-4 pt-1 pb-3 md:hidden">
          <h1 className="font-titulo text-[32px] leading-[1.1] font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-[15px] text-suave">{subtitulo}</p>}
        </div>
      )}
      {!grande && subtitulo && <p className="px-4 pt-2 text-[15px] text-suave md:hidden">{subtitulo}</p>}

      {/* Escritorio */}
      {escritorio && (
        <header className="hidden flex-col gap-2 pt-10 pb-4 md:flex">
          {atras && (
            <button onClick={volver} className="inline-flex items-center gap-1 self-start text-sm text-suave hover:text-texto">
              <ArrowLeft className="size-4" /> Volver
            </button>
          )}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {/* Solo uno de los dos títulos se muestra (y existe para los lectores de pantalla) en cada tamaño. */}
              <h1 className="font-titulo text-[30px] leading-tight font-semibold">{titulo}</h1>
              {subtitulo && <p className="mt-0.5 text-sm text-suave">{subtitulo}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {acciones}
              {principal}
            </div>
          </div>
        </header>
      )}
      {children}
    </>
  );
}

const claseBotonBarra =
  "relative grid size-11 shrink-0 place-items-center rounded-full text-texto/80 transition-colors hover:bg-superficie-2 active:bg-superficie-2 [&_svg]:size-[22px] md:size-10 md:text-suave md:[&_svg]:size-5";

/** Enlace con icono para la barra de app. */
export function EnlaceBarra({ etiqueta, className, ...props }: LinkProps & { etiqueta: string }) {
  return <Link aria-label={etiqueta} title={etiqueta} className={cn(claseBotonBarra, className)} {...props} />;
}

/** Botón de icono de la barra de app: 44 px de zona táctil, círculo al pulsar. */
export function BotonBarra({ etiqueta, className, ...props }: ComponentProps<"button"> & { etiqueta: string }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(claseBotonBarra, className)}
      {...props}
    />
  );
}
