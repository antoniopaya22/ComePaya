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

  function cambiarExacta(nuevoDia: string, nuevoMes: string) {
    setDia(nuevoDia);
    setMes(nuevoMes);
    const fecha = deducirFecha(Number(nuevoDia), Number(nuevoMes), hoy);
    if (fecha) onChange(fecha);
  }

  const exactaValida = dia && mes ? deducirFecha(Number(dia), Number(mes), hoy) : undefined;

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
                onChange(fecha);
              }}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors active:scale-95",
                activo ? "border-primario bg-primario text-primario-texto" : "border-borde bg-superficie hover:bg-superficie-2",
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
        {exactaValida === null && <span className="text-sm text-peligro">Fecha no válida</span>}
      </div>

      <p className="text-sm font-medium text-primario">{describirCaducidad(valor, hoy)}</p>
    </div>
  );
}
