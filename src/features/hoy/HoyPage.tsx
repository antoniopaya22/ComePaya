import { CalendarDays, ChevronRight, CookingPot, Hourglass, ListChecks, Plane, Plus, ScanBarcode, Settings, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Boton } from "@/components/ui/boton";
import { Esqueleto, Etiqueta, Tarjeta } from "@/components/ui/varios";
import { describirCaducidad, estadoCaducidad, hoyISO, sumarDias } from "@/dominio/caducidad";
import { emojiPara } from "@/dominio/ingredientes-base";
import { lunesDe, type TipoFranja } from "@/dominio/menu";
import type { FranjaMenu, RecetaCompleta } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { useFranjas, useIngredientes, useLista, useLotes, useRecetas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { useUsuario } from "../sesion/SesionProvider";

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
  const buscar = (fecha: string, tipo: TipoFranja) => franjas.find((f) => f.fecha === fecha && f.tipo === tipo);
  const receta = (f?: FranjaMenu) => recetas.find((r) => r.id === f?.receta_id);
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
    <div className="flex flex-col gap-5 px-4 pt-6 md:px-0 md:pt-10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-suave first-letter:uppercase">
            {DIAS[ahora.getDay()]}, {ahora.getDate()} de {MESES[ahora.getMonth()]}
          </p>
          <h1 className="font-titulo text-[30px] leading-tight font-semibold">
            {saludo(ahora.getHours())}
            {nombrePila ? `, ${nombrePila}` : ""}
          </h1>
        </div>
        <Link to="/ajustes" aria-label="Ajustes" className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie-2 text-suave md:hidden">
          {usuario.user_metadata.avatar_url ? (
            <img src={usuario.user_metadata.avatar_url} alt="" className="size-11 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <Settings className="size-5" />
          )}
        </Link>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hoy en {hogar.nombre.replace(/^Casa de /, "casa de ")}</h2>
          <Link to="/menu" className="flex items-center gap-0.5 text-sm font-medium text-primario">
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
      </section>

      {preparaciones.length > 0 && (
        <Tarjeta className="flex flex-col gap-2 border-aviso/30 bg-aviso-suave p-4 text-aviso">
          <h2 className="flex items-center gap-2 font-semibold">
            <Hourglass className="size-4" /> Por preparar
          </h2>
          {preparaciones.map(({ franja, receta: r }) => (
            <Link key={franja.id} to={`/recetas/${r.id}`} className="text-sm">
              <strong>{r.preparacion_previa}</strong> para {r.nombre.toLowerCase()} ({franja.tipo} de {franja.fecha === hoy ? "hoy" : "mañana"})
            </Link>
          ))}
        </Tarjeta>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Atajo to="/escanear" icono={<ScanBarcode />} texto="Escanear" />
        <Atajo to="/lista" icono={<Plus />} texto="A la lista" />
        <Atajo to="/menu" icono={<CalendarDays />} texto="Planificar" />
      </div>

      {urgentes.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <TriangleAlert className="size-4 text-aviso" /> Caduca pronto
            </h2>
            <Link to="/despensa" className="flex items-center gap-0.5 text-sm font-medium text-primario">
              Despensa <ChevronRight className="size-4" />
            </Link>
          </div>
          <Tarjeta className="divide-y divide-borde">
            {urgentes.slice(0, 5).map((l) => (
              <Link key={l.id} to={`/productos/${l.producto_id}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xl">{emojiPara(l.producto.ingrediente.nombre, l.producto.ingrediente.seccion_super, l.producto.ingrediente.emoji)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{l.producto.nombre}</span>
                <Etiqueta tono={estadoCaducidad(l.fecha_caducidad, hoy) === "caducado" ? "peligro" : "aviso"}>{describirCaducidad(l.fecha_caducidad, hoy)}</Etiqueta>
              </Link>
            ))}
          </Tarjeta>
        </section>
      )}

      <Link to="/lista">
        <Tarjeta className="flex items-center gap-4 p-4 transition-colors active:bg-superficie-2">
          <span className="grid size-12 place-items-center rounded-2xl bg-primario-suave text-primario">
            <ListChecks className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Lista de la compra</span>
            <span className="block truncate text-sm text-suave">
              {pendientes.length
                ? `${pendientes.length} por comprar: ${pendientes
                    .slice(0, 4)
                    .map((i) => i.texto.toLowerCase())
                    .join(", ")}${pendientes.length > 4 ? "…" : ""}`
                : "No falta nada"}
            </span>
          </span>
          <ChevronRight className="size-5 text-suave" />
        </Tarjeta>
      </Link>
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
        <Tarjeta className="flex h-full items-center gap-3 border-dashed p-4 text-suave">
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
          <Boton asChild tamano="sm" className="self-start">
            <Link to={`/recetas/${receta.id}/cocinar?raciones=${franja?.raciones ?? receta.raciones}`}>
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
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-borde bg-superficie py-3 text-sm font-medium transition-colors active:bg-superficie-2 [&_svg]:size-5 [&_svg]:text-primario">
      {icono}
      {texto}
    </Link>
  );
}
