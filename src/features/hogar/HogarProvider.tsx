import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Boton } from "@/components/ui/boton";
import { Cargando } from "@/components/ui/varios";
import { supabase } from "@/lib/supabase";
import type { Hogar, Miembro } from "@/lib/tipos";
import { mensajeError } from "@/lib/utils";
import { useUsuario } from "@/features/sesion/SesionProvider";
import { PantallaBienvenida } from "./PantallaBienvenida";

interface Pertenencia {
  rol: Miembro["rol"];
  hogar: Hogar;
}

interface HogarContexto {
  hogar: Hogar;
  rol: Miembro["rol"];
  hogares: Pertenencia[];
  cambiarHogar: (id: string) => void;
  /** Muestra de nuevo la pantalla de crear/unirse aunque ya haya hogar. */
  anadirHogar: () => void;
}

const Contexto = createContext<HogarContexto | null>(null);
const CLAVE_ACTIVO = "despensa.hogar-activo";

export function HogarProvider({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const [activoId, setActivoId] = useState<string | null>(() => leerActivo());
  const [anadiendo, setAnadiendo] = useState(false);

  const { data: hogares, isPending, error, refetch } = useQuery({
    queryKey: ["hogares", usuario.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("miembro")
        .select("rol, hogar:hogar(*)")
        .eq("user_id", usuario.id)
        .order("creado_en");
      if (error) throw error;
      return data as unknown as Pertenencia[];
    },
  });

  function cambiarHogar(id: string) {
    setActivoId(id);
    guardarActivo(id);
  }

  if (isPending) return <Cargando texto="Cargando tu hogar…" className="min-h-dvh" />;
  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <p className="text-[17px] font-semibold">No se ha podido cargar tu hogar</p>
        <p className="text-suave">{mensajeError(error)}</p>
        <Boton className="self-start" onClick={() => refetch()}>
          Reintentar
        </Boton>
      </main>
    );
  }

  if (!hogares.length || anadiendo) {
    return (
      <PantallaBienvenida
        onCancelar={hogares.length ? () => setAnadiendo(false) : undefined}
        onListo={async (hogar) => {
          await queryClient.invalidateQueries({ queryKey: ["hogares", usuario.id] });
          cambiarHogar(hogar.id);
          setAnadiendo(false);
        }}
      />
    );
  }

  const actual = hogares.find((h) => h.hogar.id === activoId) ?? hogares[0];

  return (
    <Contexto.Provider
      value={{ hogar: actual.hogar, rol: actual.rol, hogares, cambiarHogar, anadirHogar: () => setAnadiendo(true) }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useHogar() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useHogar requiere HogarProvider");
  return contexto;
}

function leerActivo() {
  try {
    return localStorage.getItem(CLAVE_ACTIVO);
  } catch {
    return null;
  }
}

function guardarActivo(id: string) {
  try {
    localStorage.setItem(CLAVE_ACTIVO, id);
  } catch {
    // Sin almacenamiento local se usa el primer hogar en cada visita.
  }
}
