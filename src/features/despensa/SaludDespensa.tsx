import { HeartPulse } from "lucide-react";
import { Tarjeta } from "@/components/ui/varios";
import { resumirSalud, type DatosSalud, type FiltroSalud } from "@/dominio/salud-despensa";
import { COLOR_NUTRISCORE, TEXTO_NUTRISCORE } from "@/lib/colores-salud";
import type { ProductoConIngrediente } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Los datos de salud de un producto; lo fresco sin código usa los nutrientes de su ingrediente. */
export function saludDeProducto(p: ProductoConIngrediente): DatosSalud {
  return { nutriscore: p.nutriscore, nova: p.nova, nutrientes: p.nutrientes_100 ?? p.ingrediente.nutrientes_100 ?? null, niveles: p.niveles_nutrientes };
}

/** Letra de Nutri-Score en pequeño, con su color oficial. */
export function NotaNutriscore({ nota, className }: { nota: "a" | "b" | "c" | "d" | "e"; className?: string }) {
  return (
    <span
      className={cn("inline-grid size-[18px] shrink-0 place-items-center rounded-[5px] text-[11px] leading-none font-bold uppercase", className)}
      style={{ background: COLOR_NUTRISCORE[nota], color: TEXTO_NUTRISCORE[nota] }}
      aria-label={`Nutri-Score ${nota.toUpperCase()}`}
      role="img"
    >
      {nota}
    </span>
  );
}

/** Cómo de sano es lo que hay en casa: reparto por Nutri-Score y atajos a los filtros. */
export function ResumenSaludDespensa({ datos, onFiltrar }: { datos: DatosSalud[]; onFiltrar: (f: FiltroSalud) => void }) {
  const r = resumirSalud(datos);
  const conNota = Object.values(r.nutriscore).reduce((a, b) => a + b, 0);
  if (r.sinDatos === r.total) return null;
  const atajos: { filtro: FiltroSalud; n: number; texto: string }[] = [
    { filtro: "ultraprocesado", n: r.ultraprocesados, texto: r.ultraprocesados === 1 ? "ultraprocesado" : "ultraprocesados" },
    { filtro: "azucar", n: r.altoAzucar, texto: "alto en azúcar" },
    { filtro: "sal", n: r.altoSal, texto: "alto en sal" },
    { filtro: "sin_datos", n: r.sinDatos, texto: "sin datos" },
  ];
  return (
    <Tarjeta className="flex flex-col gap-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <HeartPulse className="size-4 text-primario" /> Lo que hay en casa
      </h2>
      {conNota > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={`Nutri-Score: ${(["a", "b", "c", "d", "e"] as const).map((l) => `${r.nutriscore[l]} ${l.toUpperCase()}`).join(", ")}`}>
            {(["a", "b", "c", "d", "e"] as const).map((l) =>
              r.nutriscore[l] ? <span key={l} style={{ flexGrow: r.nutriscore[l], background: COLOR_NUTRISCORE[l] }} className="border-r-2 border-superficie last:border-r-0" /> : null,
            )}
          </div>
          <div className="flex justify-between text-[13px] text-suave">
            {(["a", "b", "c", "d", "e"] as const).map((l) => (
              <span key={l} className="flex items-center gap-1">
                <NotaNutriscore nota={l} /> {r.nutriscore[l]}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {atajos
          .filter((a) => a.n > 0)
          .map((a) => (
            <button
              key={a.filtro}
              type="button"
              onClick={() => onFiltrar(a.filtro)}
              className={cn(
                "h-9 rounded-full px-3 text-[13px] font-medium",
                a.filtro === "sin_datos" ? "bg-superficie-2 text-suave" : "bg-aviso-suave text-aviso",
              )}
            >
              {a.n} {a.texto}
            </button>
          ))}
      </div>
      <p className="text-xs text-suave">El Nutri-Score compara dentro de cada tipo de alimento: un aceite de oliva o un queso puntúan bajo aunque formen parte de una dieta sana.</p>
    </Tarjeta>
  );
}
