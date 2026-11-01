import { Info } from "lucide-react";
import { useMemo } from "react";
import { Tarjeta } from "@/components/ui/varios";
import { CLAVES_NUTRIENTES, nutricionPorRacion } from "@/dominio/nutricion";
import type { RecetaCompleta } from "@/lib/tipos";
import { useIngredientes, useNutrientesIngredientes } from "../datos";

const PRINCIPALES = ["kcal", "proteina", "fibra", "azucares", "sal"] as const;

/** Valores por ración (§8.2). Sin Nutri-Score: no está pensado para platos caseros. */
export function NutricionReceta({ receta }: { receta: RecetaCompleta }) {
  const { data: ingredientes = [] } = useIngredientes();
  const nutrientes = useNutrientesIngredientes();

  const { porRacion, sinDatos } = useMemo(() => {
    const porId = new Map(ingredientes.map((i) => [i.id, i]));
    return nutricionPorRacion(
      receta.raciones,
      receta.ingredientes.map((ri) => {
        const ing = porId.get(ri.ingrediente_id);
        return {
          cantidad: ri.cantidad,
          opcional: ri.opcional,
          ingrediente: {
            nombre: ri.ingrediente.nombre,
            unidad_base: ri.ingrediente.unidad_base,
            peso_unidad_g: ing?.peso_unidad_g ?? null,
            nutrientes_100: nutrientes.get(ri.ingrediente_id) ?? null,
          },
        };
      }),
    );
  }, [receta, ingredientes, nutrientes]);

  const conDatos = Object.keys(porRacion).length > 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Por ración</h2>
      {conDatos ? (
        <Tarjeta className="grid grid-cols-5 divide-x divide-borde">
          {PRINCIPALES.map((clave) => {
            const info = CLAVES_NUTRIENTES.find((c) => c.clave === clave)!;
            const valor = porRacion[clave];
            return (
              <div key={clave} className="flex flex-col items-center gap-0.5 px-1 py-3 text-center">
                <span className="text-base font-semibold">{valor === undefined ? "—" : valor.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</span>
                <span className="text-[11px] leading-tight text-suave">
                  {info.etiqueta}
                  <br />
                  {info.unidad}
                </span>
              </div>
            );
          })}
        </Tarjeta>
      ) : null}
      {sinDatos.length > 0 && (
        <p className="flex gap-2 text-xs text-suave">
          <Info className="size-3.5 shrink-0 translate-y-0.5" />
          {conDatos ? "No incluye" : "Faltan los datos nutricionales de"} {sinDatos.join(", ").toLowerCase()}. Añádelos en Ajustes → Ingredientes o
          escaneando sus productos.
        </p>
      )}
    </section>
  );
}
