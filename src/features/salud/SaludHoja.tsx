import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campos";
import { Hoja, useCambiosSinGuardar } from "@/components/ui/hoja";
import { GRUPOS_ALIMENTO, REGLAS_POR_DEFECTO, type GrupoAlimento } from "@/dominio/nutricion";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/utils";
import { useUsuario } from "../sesion/SesionProvider";
import { claves, useReglas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { SelectorAlergenos } from "./Alergenos";

type Fila = { minimo: string; maximo: string };

/** Reglas de equilibrio semanal y aditivos vigilados del hogar. */
export function SaludHoja({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const { hogar, rol } = useHogar();
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const { data: reglas = [], isPending: cargandoReglas } = useReglas();
  const [filas, setFilas] = useState<Record<GrupoAlimento, Fila>>({} as Record<GrupoAlimento, Fila>);
  const [aditivos, setAditivos] = useState("");
  const [alergenos, setAlergenos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const sucio = useCambiosSinGuardar(abierta, [filas, aditivos, alergenos]);

  // Se rellena al abrir, cuando ya han llegado las reglas (si no, guardar las borraría).
  useEffect(() => {
    if (!abierta || cargandoReglas) return;
    const inicial = {} as Record<GrupoAlimento, Fila>;
    for (const g of GRUPOS_ALIMENTO) {
      const r = reglas.find((x) => x.grupo_alimento === g.valor);
      inicial[g.valor] = { minimo: r?.minimo_semana?.toString() ?? "", maximo: r?.maximo_semana?.toString() ?? "" };
    }
    setFilas(inicial);
    setAditivos((hogar.aditivos_vigilados ?? []).join(", "));
    setAlergenos(hogar.alergenos ?? []);
  }, [abierta, cargandoReglas]);

  async function guardar() {
    setGuardando(true);
    try {
      const nuevas = GRUPOS_ALIMENTO.map((g) => ({
        hogar_id: hogar.id,
        grupo_alimento: g.valor,
        minimo_semana: filas[g.valor]?.minimo ? Number(filas[g.valor].minimo) : null,
        maximo_semana: filas[g.valor]?.maximo ? Number(filas[g.valor].maximo) : null,
      })).filter((r) => r.minimo_semana !== null || r.maximo_semana !== null);
      if (nuevas.some((r) => r.minimo_semana !== null && r.maximo_semana !== null && r.minimo_semana > r.maximo_semana)) {
        throw new Error("El mínimo no puede ser mayor que el máximo");
      }
      // Primero se guardan las nuevas y después se quitan las que sobran: si algo falla, no se pierden las anteriores.
      if (nuevas.length) {
        const { error } = await supabase.from("regla_semanal").upsert(nuevas, { onConflict: "hogar_id,grupo_alimento" });
        if (error) throw error;
      }
      const sobran = GRUPOS_ALIMENTO.map((g) => g.valor).filter((g) => !nuevas.some((n) => n.grupo_alimento === g));
      if (sobran.length) {
        const { error } = await supabase.from("regla_semanal").delete().eq("hogar_id", hogar.id).in("grupo_alimento", sobran);
        if (error) throw error;
      }
      if (rol === "admin") {
        const vigilados = [...new Set(aditivos.split(/[,\s]+/).map((a) => a.trim().toUpperCase()).filter((a) => /^E\d{3,4}[A-Z]?$/.test(a)))];
        const { error } = await supabase.from("hogar").update({ aditivos_vigilados: vigilados, alergenos }).eq("id", hogar.id);
        if (error) throw error;
      }
      void queryClient.invalidateQueries({ queryKey: claves.reglas(hogar.id) });
      void queryClient.invalidateQueries({ queryKey: ["hogares", usuario.id] });
      toast.success("Guardado");
      onCerrar();
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  function restablecer() {
    const inicial = {} as Record<GrupoAlimento, Fila>;
    for (const g of GRUPOS_ALIMENTO) {
      const r = REGLAS_POR_DEFECTO.find((x) => x.grupo_alimento === g.valor);
      inicial[g.valor] = { minimo: r?.minimo_semana?.toString() ?? "", maximo: r?.maximo_semana?.toString() ?? "" };
    }
    setFilas(inicial);
  }

  return (
    <Hoja
      abierta={abierta}
      onAbiertaChange={(v) => !v && onCerrar()}
      sucio={sucio}
      titulo="Salud"
      descripcion="Cuántas comidas y cenas a la semana con cada grupo. Las de partida siguen las recomendaciones de la AESAN."
      pie={
        <Boton className="w-full" onClick={guardar} disabled={guardando}>
          Guardar
        </Boton>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-2 gap-y-1.5 text-sm">
          <span />
          <span className="text-center text-xs text-suave">Mínimo</span>
          <span className="text-center text-xs text-suave">Máximo</span>
          {GRUPOS_ALIMENTO.map((g) => (
            <FilaRegla key={g.valor} etiqueta={g.etiqueta} fila={filas[g.valor]} onChange={(f) => setFilas({ ...filas, [g.valor]: f })} />
          ))}
        </div>
        <Boton variante="fantasma" tamano="sm" className="self-start" onClick={restablecer}>
          Volver a las de referencia
        </Boton>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-suave">Alergias e intolerancias del hogar</span>
          <SelectorAlergenos valor={alergenos} onChange={setAlergenos} desactivado={rol !== "admin"} />
          <span className="text-xs text-suave">Se avisará en productos, recetas y sugerencias que los lleven.</span>
        </div>
        <Campo
          etiqueta="Aditivos que os preocupan"
          ayuda={rol === "admin" ? "E-números separados por comas. Se destacarán en las fichas de producto." : "Solo un administrador del hogar puede cambiarlos."}
        >
          <Entrada value={aditivos} onChange={(e) => setAditivos(e.target.value)} placeholder="E250, E621" disabled={rol !== "admin"} />
        </Campo>
      </div>
    </Hoja>
  );
}

function FilaRegla({ etiqueta, fila, onChange }: { etiqueta: string; fila: Fila | undefined; onChange: (f: Fila) => void }) {
  const actual = fila ?? { minimo: "", maximo: "" };
  return (
    <>
      <span>{etiqueta}</span>
      <Entrada inputMode="numeric" className="h-11 text-center" value={actual.minimo} onChange={(e) => onChange({ ...actual, minimo: e.target.value.replace(/\D/g, "") })} placeholder="—" aria-label={`Mínimo de ${etiqueta}`} />
      <Entrada inputMode="numeric" className="h-11 text-center" value={actual.maximo} onChange={(e) => onChange({ ...actual, maximo: e.target.value.replace(/\D/g, "") })} placeholder="—" aria-label={`Máximo de ${etiqueta}`} />
    </>
  );
}
