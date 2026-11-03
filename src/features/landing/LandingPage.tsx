import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  HeartPulse,
  ListChecks,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { m as motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useSesion } from "../sesion/SesionProvider";

const FUNCIONES = [
  {
    icono: ScanBarcode,
    titulo: "Escanea y listo",
    texto: "Pasa los productos por la cámara al volver del súper. Se guardan con su caducidad, su Nutri-Score y sus alérgenos.",
  },
  {
    icono: CalendarDays,
    titulo: "Menú de la semana",
    texto: "Comidas y cenas en un vistazo, con sobras para el día siguiente y sugerencias que tiran de lo que ya tenéis.",
  },
  {
    icono: ListChecks,
    titulo: "La lista se hace sola",
    texto: "Lo que pide el menú menos lo que hay en casa, ordenado por pasillos de tu súper. Compartida y sin conexión.",
  },
  {
    icono: BookOpen,
    titulo: "Vuestro recetario",
    texto: "Tus recetas o las de tu web favorita, con raciones que se ajustan solas y un modo cocina con temporizadores.",
  },
  {
    icono: HeartPulse,
    titulo: "Comer mejor",
    texto: "Equilibrio semanal de legumbre, pescado y verdura, nutrientes por ración y avisos de los alérgenos de casa.",
  },
  {
    icono: Users,
    titulo: "Para toda la familia",
    texto: "Cada uno con su cuenta de Google y todo compartido al momento. Para la pareja, los abuelos o el piso compartido.",
  },
];

const PASOS = [
  { titulo: "Entra con Google", texto: "Crea tu hogar en un minuto e invita a los tuyos con un código." },
  { titulo: "Llena la despensa", texto: "Escanea lo que tienes o empieza con más de cien ingredientes ya preparados." },
  { titulo: "Planifica y compra", texto: "Rellena la semana con un toque y deja que la lista se haga sola." },
];

/** Página pública: qué es ComePayá y por qué usarla. Con sesión iniciada, el botón lleva a la app. */
export function LandingPage() {
  const sesion = useSesion();
  const destino = sesion ? "/" : "/entrar";
  const cta = sesion ? "Ir a mi cocina" : "Empezar gratis";

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="sticky top-0 z-30 border-b border-borde/60 bg-fondo/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/bienvenida" aria-label="ComePayá, inicio">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-6">
            <a href="#funciones" className="hidden text-sm font-medium text-suave hover:text-texto sm:block">
              Funciones
            </a>
            <a href="#como-funciona" className="hidden text-sm font-medium text-suave hover:text-texto sm:block">
              Cómo funciona
            </a>
            <Link to={destino} className="rounded-xl bg-texto px-4 py-2 text-sm font-semibold text-fondo transition-opacity hover:opacity-85">
              {sesion ? "Abrir la app" : "Entrar"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Portada */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-primario/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 md:grid-cols-[1.1fr_0.9fr] md:pt-24">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primario/25 bg-primario-suave px-3 py-1 text-xs font-semibold text-primario">
              <Sparkles className="size-3.5" /> Gratis · Para tu casa y tu familia
            </span>
            <h1 className="mt-5 text-[44px] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              La cocina de casa, <span className="text-primario italic">por fin</span> organizada.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-pretty text-suave">
              Despensa, lista de la compra y menú de la semana en un solo sitio. Escanea lo que compras, decide qué coméis y deja que la lista se haga
              sola.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={destino}
                className="inline-flex h-13 items-center gap-2 rounded-2xl bg-primario px-6 text-base font-semibold text-primario-texto shadow-lg shadow-primario/25 transition-transform active:scale-[0.98]"
              >
                {cta} <ArrowRight className="size-5" />
              </Link>
              <a href="#como-funciona" className="inline-flex h-13 items-center rounded-2xl px-5 text-base font-semibold text-texto hover:bg-superficie-2">
                Ver cómo funciona
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-suave">
              {["Sin anuncios", "Funciona sin conexión", "Se instala en el móvil"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primario" /> {t}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 24, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <MovilDeMuestra />
          </motion.div>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="scroll-mt-16 border-y border-borde bg-superficie py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Titulo antetitulo="Todo en una app" titulo="Menos «¿qué hacemos de comer?», más tiempo para comer." />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONES.map(({ icono: Icono, titulo, texto }, i) => (
              <motion.div
                key={titulo}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.05 }}
                className="rounded-3xl border border-borde bg-fondo p-6"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-primario-suave text-primario">
                  <Icono className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-suave">{texto}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-16 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Titulo antetitulo="Cómo funciona" titulo="En marcha en tres pasos." />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="relative rounded-3xl border border-borde bg-superficie p-6">
                <span className="font-titulo text-5xl font-semibold text-primario/25">{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-1.5 text-[15px] text-suave">{p.texto}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Garantia icono={<ShieldCheck />} titulo="Vuestros datos, vuestros">
              Cada hogar solo ve lo suyo. Sin anuncios y sin vender nada a nadie.
            </Garantia>
            <Garantia icono={<WifiOff />} titulo="En el súper sin cobertura">
              La lista funciona sin conexión y se sincroniza al salir.
            </Garantia>
          </div>
        </div>
      </section>

      {/* Llamada final */}
      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#1f4a36] px-6 py-14 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute -right-20 -bottom-24 size-80 rounded-full bg-[#2f6b4f] blur-2xl" />
          <h2 className="relative text-3xl font-semibold text-balance sm:text-4xl">¿Qué coméis esta semana?</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/75">Que lo decida ComePayá con lo que tenéis en la nevera.</p>
          <Link
            to={destino}
            className="relative mt-8 inline-flex h-13 items-center gap-2 rounded-2xl bg-white px-6 text-base font-semibold text-[#1f4a36] transition-transform active:scale-[0.98]"
          >
            {cta} <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-borde py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-suave">
          <Logo tamano="sm" />
          <p>Hecho en casa · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

function Titulo({ antetitulo, titulo }: { antetitulo: string; titulo: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-wide text-primario uppercase">{antetitulo}</p>
      <h2 className="mt-2 text-3xl leading-tight font-semibold text-balance sm:text-4xl">{titulo}</h2>
    </div>
  );
}

function Garantia({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-3xl bg-primario-suave p-5 [&_svg]:size-6 [&_svg]:shrink-0 [&_svg]:text-primario">
      {icono}
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="text-sm text-suave">{children}</p>
      </div>
    </div>
  );
}

/** Ilustración de la pantalla «Hoy» hecha con la propia interfaz (sin capturas que se queden viejas). */
function MovilDeMuestra() {
  return (
    <div className="relative mx-auto w-[300px] sm:w-[330px]">
      <div className="absolute -top-6 -left-10 hidden rotate-[-8deg] rounded-2xl border border-borde bg-superficie p-3 shadow-xl sm:block">
        <p className="text-[11px] font-semibold tracking-wide text-suave uppercase">Nutri-Score</p>
        <div className="mt-1.5 flex items-end gap-0.5">
          {(["#038141", "#85bb2f", "#fecb02", "#ee8100", "#e63e11"] as const).map((c, i) => (
            <span key={c} className={cn("grid place-items-center rounded font-bold text-white uppercase", i === 1 ? "h-8 w-7" : "h-6 w-5 opacity-35")} style={{ background: c }}>
              {"abcde"[i]}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute -right-8 bottom-24 z-10 hidden rotate-[6deg] rounded-2xl border border-borde bg-superficie px-3 py-2.5 shadow-xl sm:block">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-lg">🎉</span> ¡Todo comprado!
        </p>
      </div>
      <div className="rounded-[2.6rem] border-[10px] border-[#1d2420] bg-fondo shadow-2xl">
        <div className="flex flex-col gap-3 overflow-hidden rounded-[2rem] p-4">
          <div>
            <p className="text-[11px] text-suave">Martes, 4 de noviembre</p>
            <p className="font-titulo text-xl font-semibold">Buenos días</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-2.5">
            <span className="grid size-14 place-items-center rounded-xl bg-superficie-2 text-3xl">🫘</span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold tracking-wide text-suave uppercase">Comida</span>
              <span className="font-titulo block text-[15px] leading-tight font-semibold">Lentejas con chorizo</span>
              <span className="mt-1 inline-block rounded-lg bg-primario px-2 py-0.5 text-[11px] font-semibold text-primario-texto">Cocinar</span>
            </span>
          </div>
          <div className="rounded-2xl border border-aviso/30 bg-aviso-suave p-2.5 text-[12px] text-aviso">
            <strong>Poner los garbanzos en remojo</strong> para el cocido de mañana
          </div>
          <div className="rounded-2xl border border-borde bg-superficie p-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-suave uppercase">Lista · Fruta y verdura</p>
            {[
              ["🍅", "Tomate", "1 kg", false],
              ["🧅", "Cebolla", "", true],
              ["🍋", "Limón", "x3", false],
            ].map(([emoji, nombre, cantidad, hecho]) => (
              <p key={nombre as string} className="mt-1.5 flex items-center gap-2 text-[13px]">
                <span className={cn("grid size-4 place-items-center rounded-full border-2", hecho ? "border-primario bg-primario" : "border-borde")} />
                <span>{emoji}</span>
                <span className={cn("flex-1", hecho && "text-suave line-through")}>{nombre}</span>
                <span className="text-suave">{cantidad}</span>
              </p>
            ))}
          </div>
          <div className="flex justify-around border-t border-borde pt-2 text-[10px] text-suave">
            {["Hoy", "Menú", "Lista", "Despensa", "Recetas"].map((t, i) => (
              <span key={t} className={cn(i === 0 && "font-semibold text-primario")}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
