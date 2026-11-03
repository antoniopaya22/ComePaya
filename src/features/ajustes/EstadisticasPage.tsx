import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";
import { useMemo } from "react";
import { BarraApp } from "@/components/BarraApp";
import { Cargando, Tarjeta, Vacio } from "@/components/ui/varios";
import { hoyISO, sumarDias } from "@/dominio/caducidad";
import { cumplimientoSemanal, masCocinadas, masTirados } from "@/dominio/estadisticas";
import { gruposDeReceta, type GrupoAlimento } from "@/dominio/nutricion";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { consultarFranjas, useIngredientes, useRecetas, useReglas, todasLasFilas } from "../datos";
import { useHogar } from "../hogar/HogarProvider";
import { MESES_CORTOS } from "@/dominio/caducidad";

const DIAS = 90;

/** Estadísticas de los últimos 90 días (§4.7). Sin precios guardados aún no hay gasto. */
export function EstadisticasPage() {
  const { hogar } = useHogar();
  const { data: recetas = [] } = useRecetas();
  const { data: ingredientes = [] } = useIngredientes();
  const { data: reglas = [] } = useReglas();
  const hoy = hoyISO();
  const desde = sumarDias(hoy, -DIAS);

  const { data: movimientos, isPending } = useQuery({
    queryKey: ["movimientos", hogar.id, desde],
    queryFn: () =>
      todasLasFilas<{ tipo: "consumo" | "tirado"; motivo: string | null; producto: { nombre: string } | null }>((inicio, fin) =>
        supabase
          .from("movimiento_despensa")
          .select("tipo, motivo, producto:producto(nombre)")
          .eq("hogar_id", hogar.id)
          .in("tipo", ["consumo", "tirado"])
          .gte("creado_en", desde)
          .order("id")
          .range(inicio, fin),
      ),
  });
  const { data: franjas = [] } = useQuery({
    queryKey: ["franjas", hogar.id, "estadisticas", desde],
    queryFn: () => consultarFranjas(hogar.id, desde, hoy),
  });

  const datos = useMemo(() => {
    const tirados = (movimientos ?? []).filter((m) => m.tipo === "tirado");
    const grupoDe = new Map(ingredientes.map((i) => [i.id, i.grupo_alimento]));
    const grupos = new Map<string, Set<GrupoAlimento>>(
      recetas.map((r) => [r.id, gruposDeReceta(r.ingredientes.map((ri) => ({ opcional: ri.opcional, grupo: grupoDe.get(ri.ingrediente_id) ?? null })))]),
    );
    return {
      retirados: movimientos?.length ?? 0,
      tirados: tirados.length,
      masTirados: masTirados(tirados.map((m) => ({ producto: m.producto?.nombre ?? "Producto borrado", motivo: m.motivo }))),
      masCocinadas: masCocinadas(franjas).map((c) => ({ ...c, nombre: recetas.find((r) => r.id === c.receta_id)?.nombre ?? "Receta borrada" })),
      semanas: cumplimientoSemanal(franjas, grupos, reglas).slice(-8),
    };
  }, [movimientos, franjas, recetas, ingredientes, reglas]);

  return (
    <>
      <BarraApp titulo="Estadísticas" atras="/ajustes" subtitulo="Últimos 90 días" />
      {isPending ? (
        <Cargando />
      ) : !datos.retirados && !datos.masCocinadas.length ? (
        <Vacio icono={<ChartColumn />} titulo="Aún no hay datos">
          Aparecerán cuando marquéis platos como cocinados y retiréis cosas de la despensa.
        </Vacio>
      ) : (
        <div className="flex flex-col gap-4 px-4 md:px-0">
          <div className="grid grid-cols-2 gap-3">
            <Tarjeta className="p-4">
              <p className="text-3xl font-bold">{datos.retirados ? Math.round((datos.tirados / datos.retirados) * 100) : 0}%</p>
              <p className="text-sm text-suave">de lo que salió de la despensa se tiró</p>
            </Tarjeta>
            <Tarjeta className="p-4">
              <p className="text-3xl font-bold">{datos.masCocinadas.reduce((t, c) => t + c.veces, 0)}</p>
              <p className="text-sm text-suave">platos cocinados</p>
            </Tarjeta>
          </div>

          <Lista titulo="Lo que más se tira" vacio="Nada tirado. ¡Bien!" filas={datos.masTirados.map((t) => ({ nombre: t.producto, valor: t.veces }))} />
          <Lista titulo="Platos más cocinados" vacio="Ningún plato marcado como cocinado." filas={datos.masCocinadas.map((c) => ({ nombre: c.nombre, valor: c.veces }))} />

          {datos.semanas.length > 0 && (
            <Tarjeta className="flex flex-col gap-3 p-4">
              <h2 className="font-semibold">Equilibrio por semana</h2>
              <div className="flex items-end gap-2">
                {datos.semanas.map((s) => (
                  <div key={s.lunes} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className={cn("grid size-9 place-items-center rounded-full text-xs font-semibold", s.cumple ? "bg-primario text-primario-texto" : "bg-aviso-suave text-aviso")}
                      title={s.cumple ? "Cumple las reglas" : `${s.avisos} avisos`}
                    >
                      {s.cumple ? "✓" : s.avisos}
                    </span>
                    <span className="text-[10px] text-suave">{`${Number(s.lunes.slice(8))} ${MESES_CORTOS[Number(s.lunes.slice(5, 7)) - 1]}`}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-suave">Por semana (desde el lunes): ✓ si cumplió todas las reglas o el número de avisos que tuvo («poco pescado», «demasiados precocinados»…).</p>
            </Tarjeta>
          )}
        </div>
      )}
    </>
  );
}

function Lista({ titulo, vacio, filas }: { titulo: string; vacio: string; filas: { nombre: string; valor: number }[] }) {
  const maximo = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <Tarjeta className="flex flex-col gap-3 p-4">
      <h2 className="font-semibold">{titulo}</h2>
      {filas.length ? (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <li key={f.nombre} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span>{f.nombre}</span>
                <span className="font-medium text-suave">{f.valor}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
                <div className="h-full rounded-full bg-primario" style={{ width: `${(f.valor / maximo) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-suave">{vacio}</p>
      )}
    </Tarjeta>
  );
}
