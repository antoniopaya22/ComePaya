import { Baby, CalendarDays, ChevronRight, CookingPot, Hourglass, ListChecks, Plane, Plus, ScanBarcode, TriangleAlert } from "lucide-react";
import { m as motion } from "motion/react";
import { Link } from "react-router";
import { BarraApp, EnlaceBarra } from "@/components/BarraApp";
import { Avisos } from "@/components/Cuenta";
import { Logo } from "@/components/Logo";
import { FilaEnlace, Grupo } from "@/components/ui/lista";
import { Boton } from "@/components/ui/boton";
import { Esqueleto, Etiqueta, Tarjeta } from "@/components/ui/varios";
import { paraDe, type ParaFranja } from "@/dominio/bebe";
import { describirCaducidad, estadoCaducidad, hoyISO, sumarDias } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { lunesDe, type TipoFranja } from "@/dominio/menu";
import type { FranjaMenu, RecetaCompleta } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { useFranjas, useIngredientes, useLista, useLotes, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { useUsuario } from "../sesion/SesionProvider";
import { PrimerosPasos } from "./PrimerosPasos";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function saludo(hora: number) {
  if (hora < 6) return "Buenas noches";
  if (hora < 14) return "Buenos días";
  if (hora < 21) return "Buenas tardes";
  return "Buenas noches";
}

/** Lo primero al abrir la app: qué se come hoy, qué hay que preparar, qué caduca y cómo va la lista. */
export function HoyPage() {
  const usuario = useUsuario();
  const { hogar } = useHogar();
  const ahora = new Date();
  const hoy = hoyISO(ahora);
  const manana = sumarDias(hoy, 1);
  const { data: estaSemana = [], isPending } = useFranjas(lunesDe(hoy));
  const { data: siguiente = [] } = useFranjas(lunesDe(manana));
  const { data: recetas = [] } = useRecetas();
  const { data: lotes = [] } = useLotes();
  const { data: lista = [] } = useLista();
  const { data: ingredientes = [] } = useIngredientes();

  const franjas = [...estaSemana, ...siguiente.filter((f) => !estaSemana.some((e) => e.id === f.id))];
  const buscar = (fecha: string, tipo: TipoFranja, para: ParaFranja = "casa") =>
    franjas.find((f) => f.fecha === fecha && f.tipo === tipo && paraDe(f) === para);
  const receta = (f?: FranjaMenu) => recetas.find((r) => r.id === f?.receta_id);
  // Lo del bebé hoy, en una línea: "comida: puré de verduras · cena: sin planificar".
  const hoyBebe = hogar.bebe_nombre
    ? (["comida", "cena"] as const)
        .map((tipo) => {
          const f = buscar(hoy, tipo, "bebe");
          return `${tipo}: ${f?.fuera_de_casa ? "fuera de casa" : (receta(f)?.nombre.toLowerCase() ?? "sin planificar")}`;
        })
        .join(" · ")
    : null;
  const nombrePila = (usuario.user_metadata.full_name ?? usuario.user_metadata.name ?? "").split(" ")[0];

  // Preparación previa de lo que queda por cocinar hoy y mañana (remojos, descongelar…).
  const preparaciones = [hoy, manana]
    .flatMap((fecha) => (["comida", "cena"] as const).map((tipo) => buscar(fecha, tipo)))
    .filter((f): f is FranjaMenu => Boolean(f && !f.cocinado && !f.es_sobra_de && receta(f)?.preparacion_previa))
    .map((f) => ({ franja: f, receta: receta(f)! }));

  const urgentes = lotes
    .filter((l) => ["caducado", "pronto"].includes(estadoCaducidad(l.fecha_caducidad, hoy)))
    .sort((a, b) => (a.fecha_caducidad ?? "").localeCompare(b.fecha_caducidad ?? ""));
  const pendientes = lista.filter((i) => !i.marcado);
  const emojiDe = new Map(ingredientes.map((i) => [i.id, i.emoji]));

  return (
    <div className="flex flex-col gap-6 md:pt-10">
      <BarraApp
        titulo="Hoy"
        grande={false}
        escritorio={false}
        inicio={
          <Link to="/" aria-label="ComePayá">
            <Logo tamano="sm" />
          </Link>
        }
        acciones={
          <>
            <EnlaceBarra to="/escanear" etiqueta="Escanear" data-recorrido="escanear">
              <ScanBarcode />
            </EnlaceBarra>
            <Avisos />
          </>
        }
      />

      <header className="px-4 md:px-0">
        <p className="text-[15px] text-suave first-letter:uppercase">
          {DIAS[ahora.getDay()]}, {ahora.getDate()} de {MESES[ahora.getMonth()]}
        </p>
        <h1 className="font-titulo text-[32px] leading-[1.1] font-semibold tracking-tight">
          {saludo(ahora.getHours())}
          {nombrePila ? `, ${nombrePila}` : ""}
        </h1>
      </header>

      {!isPending && <PrimerosPasos franjas={franjas} className="mx-4 md:mx-0" />}

      <section className="flex flex-col gap-2.5 px-4 md:px-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold">Hoy en {hogar.nombre.replace(/^Casa de /, "casa de ")}</h2>
          <Link to="/menu" className="-mr-2 flex h-10 items-center gap-0.5 px-2 text-[15px] font-medium text-primario">
            Menú <ChevronRight className="size-4" />
          </Link>
        </div>
        {isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Esqueleto className="h-28 rounded-2xl" />
            <Esqueleto className="h-28 rounded-2xl" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["comida", "cena"] as const).map((tipo, i) => (
              <motion.div key={tipo} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <PlatoDeHoy tipo={tipo} franja={buscar(hoy, tipo)} receta={receta(buscar(hoy, tipo))} emojiDe={emojiDe} pasado={tipo === "comida" && ahora.getHours() >= 17} />
              </motion.div>
            ))}
          </div>
        )}
        {hoyBebe && (
          <Link to="/menu" className="flex items-center gap-2 rounded-2xl bg-superficie-2 px-3.5 py-2.5 text-sm">
            <Baby className="size-4 shrink-0 text-primario" />
            <span className="min-w-0 flex-1 truncate">
              <strong className="font-semibold">{hogar.bebe_nombre}</strong> · {hoyBebe}
            </span>
          </Link>
        )}
      </section>

      {preparaciones.length > 0 && (
        <Tarjeta className="mx-4 flex flex-col gap-2 bg-aviso-suave p-4 text-aviso md:mx-0 md:border-aviso/30">
          <h2 className="flex items-center gap-2 font-semibold">
            <Hourglass className="size-4" /> Por preparar
          </h2>
          {preparaciones.map(({ franja, receta: r }) => (
            <Link key={franja.id} to={`/recetas/${r.id}`} className="flex min-h-11 items-center text-sm">
              <strong>{r.preparacion_previa}</strong> para {r.nombre.toLowerCase()} ({franja.tipo} de {franja.fecha === hoy ? "hoy" : "mañana"})
            </Link>
          ))}
        </Tarjeta>
      )}

      <div className="grid grid-cols-3 gap-2.5 px-4 md:px-0">
        <Atajo to="/escanear" icono={<ScanBarcode />} texto="Escanear" />
        <Atajo to="/lista" icono={<Plus />} texto="A la lista" />
        <Atajo to="/menu" icono={<CalendarDays />} texto="Planificar" />
      </div>

      {urgentes.length > 0 && (
        <Grupo
          titulo={
            <span className="flex items-center gap-1.5">
              <TriangleAlert className="size-3.5 text-aviso" /> Caduca pronto
            </span>
          }
          extra={
            <Link to="/despensa" className="font-medium text-primario">
              Despensa
            </Link>
          }
        >
          {urgentes.slice(0, 5).map((l) => (
            <FilaEnlace
              key={l.id}
              to={`/productos/${l.producto_id}`}
              inicio={emojiPara(l.producto.ingrediente.nombre, l.producto.ingrediente.seccion_super, l.producto.ingrediente.emoji)}
              titulo={l.producto.nombre}
              fin={<Etiqueta tono={estadoCaducidad(l.fecha_caducidad, hoy) === "caducado" ? "peligro" : "aviso"}>{describirCaducidad(l.fecha_caducidad, hoy)}</Etiqueta>}
            />
          ))}
        </Grupo>
      )}

      <Grupo titulo="Compra">
        <FilaEnlace
          to="/lista"
          inicio={<ListChecks className="text-primario!" />}
          titulo="Lista de la compra"
          detalle={
            pendientes.length
              ? `${pendientes.length} por comprar: ${pendientes
                  .slice(0, 4)
                  .map((i) => i.texto.toLowerCase())
                  .join(", ")}${pendientes.length > 4 ? "…" : ""}`
              : "No falta nada"
          }
          fin={<ChevronRight className="size-5" />}
        />
      </Grupo>
    </div>
  );
}

function PlatoDeHoy({
  tipo,
  franja,
  receta,
  emojiDe,
  pasado,
}: {
  tipo: TipoFranja;
  franja?: FranjaMenu;
  receta?: RecetaCompleta;
  emojiDe: Map<string, string | null>;
  pasado: boolean;
}) {
  const titulo = tipo === "comida" ? "Comida" : "Cena";
  if (franja?.fuera_de_casa) {
    return (
      <Tarjeta className="flex h-full items-center gap-3 p-4">
        <span className="grid size-16 place-items-center rounded-2xl bg-superficie-2 text-suave">
          <Plane className="size-6" />
        </span>
        <span>
          <span className="block text-xs font-semibold tracking-wide text-suave uppercase">{titulo}</span>
          <span className="font-medium">Fuera de casa</span>
        </span>
      </Tarjeta>
    );
  }
  if (!receta) {
    return (
      <Link to="/menu">
        <Tarjeta className="flex h-full items-center gap-3 border border-dashed border-borde-control/60 p-4 text-suave">
          <span className="grid size-16 place-items-center rounded-2xl bg-superficie-2">
            <Plus className="size-6" />
          </span>
          <span>
            <span className="block text-xs font-semibold tracking-wide uppercase">{titulo}</span>
            <span className="font-medium">Sin planificar</span>
          </span>
        </Tarjeta>
      </Link>
    );
  }
  const principal = [...receta.ingredientes].filter((i) => !i.opcional).sort((a, b) => b.cantidad - a.cantidad)[0];
  return (
    <Tarjeta className={cn("flex h-full items-center gap-3 overflow-hidden p-3", (franja?.cocinado || pasado) && "opacity-70")}>
      <Link to={`/recetas/${receta.id}`} className="shrink-0">
        {receta.foto_url ? (
          <img src={receta.foto_url} alt="" className="size-20 rounded-2xl object-cover" />
        ) : (
          <span className="grid size-20 place-items-center rounded-2xl bg-superficie-2 text-4xl">
            {principal ? emojiPara(principal.ingrediente.nombre, null, emojiDe.get(principal.ingrediente_id)) : "🍽️"}
          </span>
        )}
      </Link>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-suave uppercase">
          {titulo}
          {franja?.es_sobra_de ? " · sobras" : ""}
          {franja?.cocinado ? " · hecha" : ""}
        </span>
        <Link to={`/recetas/${receta.id}`} className="font-titulo truncate text-lg leading-tight font-semibold">
          {receta.nombre}
        </Link>
        {!franja?.cocinado && !franja?.es_sobra_de && (
          <Boton asChild className="self-start">
            <Link to={`/recetas/${receta.id}/cocinar?raciones=${franja?.raciones ?? receta.raciones}${franja ? `&franja=${franja.id}` : ""}`}>
              <CookingPot /> Cocinar
            </Link>
          </Boton>
        )}
      </span>
    </Tarjeta>
  );
}

function Atajo({ to, icono, texto }: { to: string; icono: React.ReactNode; texto: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-superficie py-3.5 text-[14px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors active:bg-superficie-2 md:border md:border-borde [&_svg]:size-[22px] [&_svg]:text-primario"
    >
      {icono}
      {texto}
    </Link>
  );
}
