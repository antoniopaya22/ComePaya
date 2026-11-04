import { Info, Package, TriangleAlert } from "lucide-react";
import { aditivosVigilados } from "@/dominio/nutricion";
import type { NivelNutriente, ProductoExterno } from "@/dominio/producto-externo";
import type { Producto } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { useHogar } from "../hogar/HogarProvider";
import { ChipsAlergenos } from "../salud/Alergenos";
import { COLOR_NOVA, COLOR_NUTRISCORE, TEXTO_NOVA_COLOR, TEXTO_NUTRISCORE } from "@/lib/colores-salud";

const TEXTO_NOVA = { 1: "Sin procesar o mínimamente procesado", 2: "Ingrediente culinario procesado", 3: "Procesado", 4: "Ultraprocesado" } as const;
const TEXTO_NIVEL: Record<"grasa" | "saturadas" | "azucares" | "sal", Record<NivelNutriente, string>> = {
  grasa: { bajo: "Poca grasa", moderado: "Grasa moderada", alto: "Mucha grasa" },
  saturadas: { bajo: "Pocas saturadas", moderado: "Saturadas moderadas", alto: "Muchas saturadas" },
  azucares: { bajo: "Poco azúcar", moderado: "Azúcar moderado", alto: "Mucho azúcar" },
  sal: { bajo: "Poca sal", moderado: "Sal moderada", alto: "Mucha sal" },
};
const TONO_NIVEL: Record<NivelNutriente, string> = {
  bajo: "bg-[#038141]/15 text-[#038141] dark:text-[#5fd08f]",
  moderado: "bg-[#ee8100]/15 text-[#b86300] dark:text-[#ffb35c]",
  alto: "bg-[#e63e11]/15 text-[#c4330c] dark:text-[#ff8a69]",
};

/** Mínimo de datos clave para dar valoraciones; por debajo se avisa en lugar de puntuar (§8.1). */
const COMPLETITUD_MINIMA = 0.6;

/** Producto guardado del hogar con la forma de los datos externos, para reutilizar la ficha. */
export function productoAExterno(p: Producto): ProductoExterno {
  return {
    ean: p.ean ?? "",
    nombre: p.nombre,
    marca: p.marca,
    cantidad_texto: null,
    cantidad_envase: p.cantidad_envase,
    unidad_envase: null,
    foto_url: p.foto_url,
    nutrientes_100: p.nutrientes_100,
    nutriscore: p.nutriscore,
    nova: p.nova,
    niveles_nutrientes: p.niveles_nutrientes,
    aditivos: p.aditivos ?? [],
    alergenos: p.alergenos ?? [],
    completitud_datos: p.completitud_datos ?? 0,
    fuente: p.fuente === "mercadona" ? "mercadona" : "openfoodfacts",
  };
}

/**
 * Ficha de salud de un producto (§8.1). `compacta`: sin la explicación del Nutri-Score ni la lista de aditivos,
 * para el panel del escáner (los vigilados se avisan igualmente).
 */
export function FichaProducto({ producto, compacta = false }: { producto: ProductoExterno; compacta?: boolean }) {
  const { hogar } = useHogar();
  const vigilados = aditivosVigilados(producto.aditivos, hogar.aditivos_vigilados ?? []);
  const incompleta = producto.completitud_datos < COMPLETITUD_MINIMA;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {producto.foto_url ? (
          <img src={producto.foto_url} alt="" className={cn("shrink-0 rounded-2xl bg-white object-contain p-1", compacta ? "size-16" : "size-24")} />
        ) : (
          <div className={cn("grid shrink-0 place-items-center rounded-2xl bg-superficie-2 text-suave", compacta ? "size-16" : "size-24")}>
            <Package className="size-8" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-lg leading-snug font-semibold">{producto.nombre ?? "Producto sin nombre"}</p>
          <p className="text-sm text-suave">{[producto.marca, producto.cantidad_texto].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 font-mono text-xs text-suave">{producto.ean}</p>
        </div>
      </div>

      {incompleta ? (
        <p className="flex gap-2 rounded-xl bg-aviso-suave p-3 text-sm text-aviso">
          <Info className="mt-0.5 size-4 shrink-0" />
          La ficha de este producto está incompleta en Open Food Facts, así que no se muestra valoración.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-superficie-2 p-3">
              <p className="text-xs font-medium text-suave">Nutri-Score</p>
              {producto.nutriscore ? (
                <div className="mt-1.5 flex gap-0.5">
                  {(["a", "b", "c", "d", "e"] as const).map((letra) => (
                    <span
                      key={letra}
                      className={cn(
                        "grid place-items-center rounded font-bold uppercase transition-all",
                        letra === producto.nutriscore ? "h-8 w-7 text-base" : "h-6 w-5 self-center text-xs opacity-35",
                      )}
                      style={{ background: COLOR_NUTRISCORE[letra], color: TEXTO_NUTRISCORE[letra] }}
                    >
                      {letra}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-sm">Sin datos</p>
              )}
            </div>
            <div className="rounded-xl bg-superficie-2 p-3">
              <p className="text-xs font-medium text-suave">Grado de procesado (NOVA)</p>
              {producto.nova ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg font-bold" style={{ background: COLOR_NOVA[producto.nova], color: TEXTO_NOVA_COLOR[producto.nova] }}>
                    {producto.nova}
                  </span>
                  <span className="text-xs leading-tight">{TEXTO_NOVA[producto.nova]}</span>
                </div>
              ) : (
                <p className="mt-1.5 text-sm">Sin datos</p>
              )}
            </div>
          </div>
          <p className={cn("-mt-2 text-xs text-suave", compacta && "hidden")}>El Nutri-Score compara con productos de la misma categoría: un aceite de oliva puntúa bajo aunque sea parte de una dieta sana.</p>

          {producto.niveles_nutrientes && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TEXTO_NIVEL) as (keyof typeof TEXTO_NIVEL)[]).map((clave) => {
                const nivel = producto.niveles_nutrientes?.[clave];
                return nivel ? (
                  <span key={clave} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONO_NIVEL[nivel])}>
                    {TEXTO_NIVEL[clave][nivel]}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </>
      )}

      {producto.alergenos?.length > 0 && <ChipsAlergenos alergenos={producto.alergenos} />}

      {vigilados.length > 0 && (
        <p className="flex gap-2 rounded-xl bg-peligro-suave p-3 text-sm font-medium text-peligro">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Lleva {vigilados.length === 1 ? "un aditivo" : "aditivos"} que vigiláis: {vigilados.join(", ")}
        </p>
      )}

      {!compacta && producto.aditivos.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">{producto.aditivos.length} aditivos:</span>{" "}
          {producto.aditivos.map((a, i) => (
            <span key={a} className={vigilados.includes(a) ? "font-semibold text-peligro" : "text-suave"}>
              {a}
              {i < producto.aditivos.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
