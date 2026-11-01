import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Boton } from "./boton";
import { Hoja } from "./hoja";

interface Peticion {
  titulo: string;
  mensaje?: string;
  aceptar?: string;
  peligro?: boolean;
}

const Contexto = createContext<(p: Peticion) => Promise<boolean>>(() => Promise.resolve(false));

/** Sustituye a window.confirm por un panel con el estilo de la app. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [peticion, setPeticion] = useState<Peticion | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirmar = useCallback(
    (p: Peticion) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setPeticion(p);
      }),
    [],
  );

  const responder = (v: boolean) => {
    resolver.current(v);
    setPeticion(null);
  };

  return (
    <Contexto.Provider value={confirmar}>
      {children}
      <Hoja
        abierta={peticion !== null}
        onAbiertaChange={(v) => !v && responder(false)}
        titulo={peticion?.titulo ?? ""}
        descripcion={peticion?.mensaje}
        pie={
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => responder(false)}>
              Cancelar
            </Boton>
            <Boton variante={peticion?.peligro ? "peligro" : "primario"} onClick={() => responder(true)}>
              {peticion?.aceptar ?? "Aceptar"}
            </Boton>
          </div>
        }
      >
        <span />
      </Hoja>
    </Contexto.Provider>
  );
}

export function useConfirmar() {
  return useContext(Contexto);
}
