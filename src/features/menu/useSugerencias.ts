import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { alergenosDeReceta, conflictos } from "@/dominio/alergenos";
import { paraDe, recetasPara, type ParaFranja } from "@/dominio/bebe";
import { diasHasta, hoyISO, sumarDias, type FechaISO } from "@/dominio/caducidad";
import { contarGrupos, gruposDeReceta, type GrupoAlimento } from "@/dominio/nutricion";
import type { ContextoSemana } from "@/dominio/planificar";
import { puntuarRecetas, type Sugerencia } from "@/dominio/sugerencias";
import { supabase } from "@/lib/supabase";
import type { FranjaMenu, RecetaCompleta } from "@/lib/tipos";
import { consultarFranjas, useAlergenosIngredientes, useIngredientes, useLotes, useRecetas, useReglas } from "../datos";
import { stockDeLotes } from "../despensa/stock";
import { useHogar } from "../hogar/HogarProvider";

/** Días durante los que una receta rechazada ("no me apetece") deja de sugerirse. */
const DIAS_RECHAZO = 3;

export const claveRechazos = (hogarId: string) => ["rechazos", hogarId];

/**
 * Todo lo que la puntuación de recetas necesita saber de la semana (§9): recetas aptas (sin alérgenos del hogar),
 * stock, caducidades, grupos ya planificados, cuándo se comió cada plato y rechazos recientes.
 * `excluir`: franja que se está editando (no cuenta como ya planificada). `para`: la casa o el bebé, cada uno
 * con sus recetas y su propia variedad.
 */
export function useContextoSemana(
  desde: FechaISO,
  todasLasFranjas: FranjaMenu[],
  excluir?: string,
  para: ParaFranja = "casa",
): { aptas: RecetaCompleta[]; base: ContextoSemana } {
  const { hogar } = useHogar();
  const { data: recetas = [] } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: lotes = [] } = useLotes();
  const { data: reglas = [] } = useReglas();
  const alergenosIngrediente = useAlergenosIngredientes();
  const hoy = hoyISO();

  const { data: historial = [] } = useQuery({
    queryKey: ["franjas", hogar.id, "historial", desde],
    queryFn: () => consultarFranjas(hogar.id, sumarDias(desde, -30), sumarDias(desde, -1)),
  });
  const { data: rechazadas = [] } = useQuery({
    queryKey: [...claveRechazos(hogar.id), hoy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rechazo_sugerencia")
        .select("receta_id")
        .eq("hogar_id", hogar.id)
        .gte("fecha", sumarDias(hoy, -DIAS_RECHAZO));
      if (error) throw error;
      return (data ?? []).map((r) => r.receta_id as string);
    },
  });

  return useMemo(() => {
    const franjasSemana = todasLasFranjas.filter((f) => paraDe(f) === para);
    const nombre = new Map(ingredientes.map((i) => [i.id, i.nombre]));
    const grupoDe = new Map(ingredientes.map((i) => [i.id, i.grupo_alimento]));
    const gruposPorReceta = new Map<string, Set<GrupoAlimento>>(
      recetas.map((r) => [r.id, gruposDeReceta(r.ingredientes.map((ri) => ({ opcional: ri.opcional, grupo: grupoDe.get(ri.ingrediente_id) ?? null })))]),
    );

    const caducanPronto = new Map<string, { dias: number; nombre: string; fecha: FechaISO }>();
    for (const l of lotes) {
      if (!l.fecha_caducidad) continue;
      const dias = diasHasta(l.fecha_caducidad, desde);
      if (dias < 0 || dias > 10) continue;
      const id = l.producto.ingrediente_id;
      if (dias < (caducanPronto.get(id)?.dias ?? Infinity)) caducanPronto.set(id, { dias, nombre: nombre.get(id) ?? l.producto.nombre, fecha: l.fecha_caducidad });
    }

    const ultimaVez = new Map<string, FechaISO>();
    for (const f of [...historial.filter((f) => paraDe(f) === para), ...franjasSemana.filter((f) => f.id !== excluir)]) {
      if (f.receta_id && !f.fuera_de_casa && (ultimaVez.get(f.receta_id) ?? "") < f.fecha) ultimaVez.set(f.receta_id, f.fecha);
    }

    // Nunca se sugiere un plato con alérgenos que afecten al hogar.
    const aptas = recetasPara(para, recetas).filter(
      (r) =>
        !conflictos(
          alergenosDeReceta(r.ingredientes.map((ri) => ({ opcional: ri.opcional, alergenos: alergenosIngrediente.get(ri.ingrediente_id) ?? [] }))).contiene,
          hogar.alergenos ?? [],
        ).length,
    );

    return {
      aptas,
      base: {
        hoy,
        stock: stockDeLotes(lotes),
        basicos: new Set(ingredientes.filter((i) => i.siempre_disponible).map((i) => i.id)),
        caducanPronto,
        gruposPorReceta,
        cuentaGrupos: contarGrupos(franjasSemana.filter((f) => f.id !== excluir), gruposPorReceta),
        reglas,
        ultimaVez,
        rechazadas: new Set(rechazadas),
      },
    };
  }, [recetas, ingredientes, lotes, reglas, historial, rechazadas, todasLasFranjas, para, desde, hoy, excluir, alergenosIngrediente, hogar.alergenos]);
}

/** Sugerencias de recetas para una franja (§9.1). */
export function useSugerencias(
  fecha: FechaISO,
  raciones: number,
  franjaId: string | undefined,
  franjasSemana: FranjaMenu[],
  para: ParaFranja = "casa",
): Sugerencia[] {
  const { aptas, base } = useContextoSemana(fecha, franjasSemana, franjaId, para);
  return useMemo(() => {
    // Para este día, la variedad solo mira hacia atrás.
    const ultimaVez = new Map([...base.ultimaVez].filter(([, f]) => f < fecha));
    return puntuarRecetas(aptas, { ...base, fecha, raciones, ultimaVez });
  }, [aptas, base, fecha, raciones]);
}
