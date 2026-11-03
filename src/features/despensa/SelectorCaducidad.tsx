import { useState } from "react";
import { ATAJOS_CADUCIDAD, deducirFecha, describirCaducidad, type FechaISO } from "@/dominio/caducidad";
import { cn } from "@/lib/utils";

/**
 * Chips rápidos + fecha exacta con día y mes (§7.2). El año se deduce.
 * `valor`: fecha elegida, null = sin caducidad.
 */
export function SelectorCaducidad({ valor, onChange, hoy }: { valor: FechaISO | null; onChange: (fecha: FechaISO | null) => void; hoy: FechaISO }) {
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  // Año opcional: solo hace falta para fechas pasadas hace más de un mes (algo que ya caducó hace tiempo).
  const [anio, setAnio] = useState("");
  const anioNumero = anio.length === 2 || anio.length === 4 ? Number(anio) : null;

  function cambiarExacta(nuevoDia: string, nuevoMes: string, nuevoAnio = anio) {
    setDia(nuevoDia);
    setMes(nuevoMes);
    setAnio(nuevoAnio);
    const fecha = deducirFecha(Number(nuevoDia), Number(nuevoMes), hoy, nuevoAnio.length === 2 || nuevoAnio.length === 4 ? Number(nuevoAnio) : null);
    if (fecha) onChange(fecha);
  }

  const exactaValida = dia && mes ? deducirFecha(Number(dia), Number(mes), hoy, anioNumero) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {ATAJOS_CADUCIDAD.map((atajo) => {
          const fecha = atajo.calcular(hoy);
          const activo = fecha === valor;
          return (
            <button
              key={atajo.etiqueta}
              type="button"
              onClick={() => {
                setDia("");
                setMes("");
                setAnio("");
                onChange(fecha);
              }}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors active:scale-95",
                activo
                  ? atajo.etiqueta === "Ya caducado"
                    ? "border-peligro bg-peligro text-sobre-color"
                    : "border-primario bg-primario text-primario-texto"
                  : atajo.etiqueta === "Ya caducado"
                    ? "border-peligro/40 bg-superficie text-peligro"
                    : "border-borde bg-superficie hover:bg-superficie-2",
              )}
            >
              {atajo.etiqueta}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-suave">o el día</span>
        <input
          inputMode="numeric"
          placeholder="DD"
          maxLength={2}
          value={dia}
          onChange={(e) => cambiarExacta(e.target.value.replace(/\D/g, ""), mes)}
          className="h-10 w-14 rounded-xl border border-borde bg-superficie text-center text-[16px] outline-none focus:border-primario"
          aria-label="Día de caducidad"
        />
        <span className="text-suave">/</span>
        <input
          inputMode="numeric"
          placeholder="MM"
          maxLength={2}
          value={mes}
          onChange={(e) => cambiarExacta(dia, e.target.value.replace(/\D/g, ""))}
          className="h-10 w-14 rounded-xl border border-borde bg-superficie text-center text-[16px] outline-none focus:border-primario"
          aria-label="Mes de caducidad"
        />
        <span className="text-suave">/</span>
        <input
          inputMode="numeric"
          placeholder={dia && mes && exactaValida ? exactaValida.slice(0, 4) : "AAAA"}
          maxLength={4}
          value={anio}
          onChange={(e) => cambiarExacta(dia, mes, e.target.value.replace(/\D/g, ""))}
          className="h-10 w-18 rounded-xl border border-borde bg-superficie text-center text-[16px] outline-none placeholder:text-suave/60 focus:border-primario"
          aria-label="Año de caducidad (opcional)"
        />
        {exactaValida === null && <span className="text-sm text-peligro">Fecha no válida</span>}
      </div>

      <p className="text-sm font-medium text-primario">{describirCaducidad(valor, hoy)}</p>
    </div>
  );
}
