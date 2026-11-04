import { House, Users } from "lucide-react";
import { m as motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";
import { Tarjeta } from "@/components/ui/varios";
import { supabase } from "@/lib/supabase";
import type { Hogar } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { cargarIngredientesBase } from "@/features/despensa/altas";
import { PanelMarca } from "@/features/sesion/PantallaLogin";
import { useUsuario } from "@/features/sesion/SesionProvider";
import { Logo } from "@/components/Logo";

export function PantallaBienvenida({ onListo, onCancelar }: { onListo: (hogar: Hogar) => void; onCancelar?: () => void }) {
  const usuario = useUsuario();
  const nombrePila = (usuario.user_metadata.full_name ?? usuario.user_metadata.name ?? "").split(" ")[0];
  const [nombre, setNombre] = useState(nombrePila ? `Casa de ${nombrePila}` : "Mi casa");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState<"crear" | "unirse" | null>(null);

  async function ejecutar(accion: "crear" | "unirse", e: FormEvent) {
    e.preventDefault();
    setEnviando(accion);
    const { data, error } =
      accion === "crear"
        ? await supabase.rpc("crear_hogar", { p_nombre: nombre })
        : await supabase.rpc("unirse_hogar", { p_codigo: codigo });
    setEnviando(null);
    if (error) return toast.error(mensajeError(error));
    // Un código que no existe devuelve un hogar vacío (no un error: así el servidor cuenta el intento).
    const hogar = data as Hogar | null;
    if (!hogar?.id) return toast.error("Código de invitación no válido");
    if (accion === "crear") {
      // Ingredientes habituales para no empezar de cero (se pueden borrar o editar en Ajustes).
      const { data: existentes } = await supabase.from("ingrediente").select("nombre").eq("hogar_id", hogar.id);
      await cargarIngredientesBase(hogar.id, existentes ?? []).catch(() => 0);
    }
    toast.success(accion === "crear" ? `Hogar «${hogar.nombre}» creado` : `Te has unido a «${hogar.nombre}»`);
    onListo(hogar);
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <PanelMarca>
        <h2 className="text-4xl leading-tight font-semibold text-balance">Un hogar, todas las cuentas que haga falta.</h2>
        <p className="mt-4 text-white/75">La despensa, la lista y el menú se comparten al momento entre los miembros. Cada uno entra con su Google.</p>
      </PanelMarca>
      <section className="pb-seguro mx-auto flex w-full max-w-md flex-col justify-center gap-5 px-5 py-10">
      <Logo className="md:hidden" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[30px] font-semibold">{nombrePila ? `¡Hola, ${nombrePila}!` : "¡Hola!"}</h1>
        <p className="mt-1 text-suave">
          Un hogar junta la despensa, la lista y el menú de varias personas. Crea el tuyo o únete al de tu familia con su código.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Tarjeta className="p-5">
          <form onSubmit={(e) => ejecutar("crear", e)} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primario-suave text-primario">
                <House className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Crear un hogar</h2>
                <p className="text-sm text-suave">Luego compartes el código con los demás.</p>
              </div>
            </div>
            <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required aria-label="Nombre del hogar" />
            <Boton type="submit" disabled={enviando !== null || !nombre.trim()}>
              {enviando === "crear" ? "Creando…" : "Crear hogar"}
            </Boton>
          </form>
        </Tarjeta>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Tarjeta className="p-5">
          <form onSubmit={(e) => ejecutar("unirse", e)} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primario-suave text-primario">
                <Users className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Unirme a un hogar</h2>
                <p className="text-sm text-suave">Pide el código a quien lo creó (está en Ajustes).</p>
              </div>
            </div>
            <Entrada
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono tracking-[0.3em] uppercase"
              maxLength={12}
              aria-label="Código de invitación"
            />
            <Boton type="submit" variante="secundario" disabled={enviando !== null || codigo.trim().length < 8}>
              {enviando === "unirse" ? "Uniéndome…" : "Unirme"}
            </Boton>
          </form>
        </Tarjeta>
      </motion.div>

      {onCancelar && (
        <Boton variante="fantasma" onClick={onCancelar}>
          Volver
        </Boton>
      )}
      </section>
    </main>
  );
}
