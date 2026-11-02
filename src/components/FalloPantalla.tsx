import { Component, type ErrorInfo, type ReactNode } from "react";
import { esErrorDeCarga, recargarPorVersion } from "@/lib/actualizacion";
import { registrarError, urlReportarProblema } from "@/lib/errores";

/** Si una pantalla falla al pintarse, muestra un aviso con salida en lugar de dejarla en blanco. */
export class FalloPantalla extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Una pantalla de una versión anterior que ya no está en el servidor: recargando se pasa a la nueva.
    if (esErrorDeCarga(error) && recargarPorVersion()) return;
    registrarError(error, `pantalla: ${info.componentStack?.split("\n").find((l) => l.trim())?.trim() ?? ""}`);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="text-5xl">🫠</span>
        <h1 className="text-2xl font-semibold">Algo ha fallado en esta pantalla</h1>
        <p className="max-w-sm text-sm text-suave">Ya ha quedado registrado. Puedes volver a intentarlo o contarnos qué estabas haciendo.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => location.reload()} className="h-11 rounded-xl bg-primario px-4 font-medium text-primario-texto">
            Volver a cargar
          </button>
          <a href={urlReportarProblema(this.state.error.message)} target="_blank" rel="noreferrer" className="grid h-11 place-items-center rounded-xl bg-superficie-2 px-4 font-medium">
            Reportar el problema
          </a>
        </div>
      </div>
    );
  }
}
