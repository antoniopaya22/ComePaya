import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { diasHasta, hoyISO, sumarDias, type FechaISO } from "@/dominio/caducidad";
import { contarGrupos, gruposDeReceta, type GrupoAlimento } from "@/dominio/nutricion";
import { puntuarRecetas, type Sugerencia } from "@/dominio/sugerencias";
import { supabase } from "@/lib/supabase";
import type { FranjaMenu } from "@/lib/tipos";
import { consultarFranjas, useIngredientes, useLotes, useRecetas, useReglas } from "../datos";
import { stockDeLotes } from "../despensa/stock";
import { useHogar } from "../hogar/HogarProvider";

/** Días durante los que una receta rechazada ("no me apetece") deja de sugerirse. */
const DIAS_RECHAZO = 3;

export const claveRechazos = (hogarId: string) => ["rechazos", hogarId];

/** Sugerencias de recetas para una franja (§9.1), con todo lo que la puntuación necesita saber. */
export function useSugerencias(fecha: FechaISO, raciones: number, franjaId: string | undefined, franjasSemana: FranjaMenu[]): Sugerencia[] {
  const { hogar } = useHogar();
  const { data: recetas = [] } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: lotes = [] } = useLotes();
  const { data: reglas = [] } = useReglas();
  const hoy = hoyISO();

  const { data: historial = [] } = useQuery({
    queryKey: ["franjas", hogar.id, "historial", fecha],
    queryFn: () => consultarFranjas(hogar.id, sumarDias(fecha, -30), sumarDias(fecha, -1)),
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
    const nombre = new Map(ingredientes.map((i) => [i.id, i.nombre]));
    const grupoDe = new Map(ingredientes.map((i) => [i.id, i.grupo_alimento]));
    const gruposPorReceta = new Map<string, Set<GrupoAlimento>>(
      recetas.map((r) => [r.id, gruposDeReceta(r.ingredientes.map((ri) => ({ opcional: ri.opcional, grupo: grupoDe.get(ri.ingrediente_id) ?? null })))]),
    );

    const caducanPronto = new Map<string, { dias: number; nombre: string; fecha: FechaISO }>();
    for (const l of lotes) {
      if (!l.fecha_caducidad) continue;
      const dias = diasHasta(l.fecha_caducidad, fecha);
      if (dias < 0 || dias > 5) continue;
      const id = l.producto.ingrediente_id;
      if (dias < (caducanPronto.get(id)?.dias ?? Infinity)) caducanPronto.set(id, { dias, nombre: nombre.get(id) ?? l.producto.nombre, fecha: l.fecha_caducidad });
    }

    const ultimaVez = new Map<string, FechaISO>();
    for (const f of [...historial, ...franjasSemana.filter((f) => f.fecha < fecha)]) {
      if (f.receta_id && !f.fuera_de_casa && (ultimaVez.get(f.receta_id) ?? "") < f.fecha) ultimaVez.set(f.receta_id, f.fecha);
    }

    return puntuarRecetas(recetas, {
      fecha,
      hoy,
      raciones,
      stock: stockDeLotes(lotes),
      basicos: new Set(ingredientes.filter((i) => i.siempre_disponible).map((i) => i.id)),
      caducanPronto,
      gruposPorReceta,
      cuentaGrupos: contarGrupos(franjasSemana.filter((f) => f.id !== franjaId), gruposPorReceta),
      reglas,
      ultimaVez,
      rechazadas: new Set(rechazadas),
    });
  }, [recetas, ingredientes, lotes, reglas, historial, rechazadas, franjasSemana, fecha, hoy, raciones, franjaId]);
}
