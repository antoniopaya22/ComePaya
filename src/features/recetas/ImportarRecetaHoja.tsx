import { Globe, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campos";
import { Hoja } from "@/components/ui/hoja";
import type { RecetaWeb } from "@/dominio/importar";
import { llamarApi } from "@/lib/api";

export interface RecetaImportada {
  receta: RecetaWeb;
  url: string;
}

/** Pide la URL de una receta y abre el editor con lo que publica la web, para revisarlo antes de guardar. */
export function ImportarRecetaHoja({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function importar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const respuesta = await llamarApi(`/api/importar-receta?url=${encodeURIComponent(url.trim())}`);
      const cuerpo = await respuesta.json().catch(() => ({ error: "Respuesta no válida" }));
      if (!respuesta.ok) return setError(cuerpo.error ?? "No se ha podido importar");
      onCerrar();
      setUrl("");
      void navigate("/recetas/nueva", { state: { receta: cuerpo, url: url.trim() } satisfies RecetaImportada });
    } catch {
      setError("Sin conexión");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Hoja
      abierta={abierta}
      onAbiertaChange={(v) => !v && onCerrar()}
      titulo="Importar desde una web"
      descripcion="Pega la dirección de una receta. Se abrirá el editor para que revises cantidades e ingredientes antes de guardar."
    >
      <form onSubmit={importar} className="flex flex-col gap-3 pb-2">
        <div className="relative">
          <Globe className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" />
          <Entrada value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.directoalpaladar.com/…" inputMode="url" type="url" className="pl-10" autoFocus />
        </div>
        {error && <p className="text-sm text-peligro">{error}</p>}
        <Boton type="submit" disabled={cargando || !url.trim()}>
          {cargando ? <LoaderCircle className="animate-spin" /> : null} {cargando ? "Leyendo la receta…" : "Importar"}
        </Boton>
      </form>
    </Hoja>
  );
}
