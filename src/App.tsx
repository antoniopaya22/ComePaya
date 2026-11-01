import { BrowserRouter, Route, Routes } from "react-router";
import { Estructura } from "@/components/Estructura";
import { Cargando } from "@/components/ui/varios";
import { supabaseConfigurado } from "@/lib/supabase";
import { AjustesPage } from "@/features/ajustes/AjustesPage";
import { EstadisticasPage } from "@/features/ajustes/EstadisticasPage";
import { IngredientesPage } from "@/features/ajustes/IngredientesPage";
import { DespensaPage } from "@/features/despensa/DespensaPage";
import { ModoCocinaPage } from "@/features/cocina/ModoCocinaPage";
import { EscanerPage } from "@/features/escaner/EscanerPage";
import { HogarProvider } from "@/features/hogar/HogarProvider";
import { ListaPage } from "@/features/lista/ListaPage";
import { MenuPage } from "@/features/menu/MenuPage";
import { EditorRecetaPage } from "@/features/recetas/EditorRecetaPage";
import { RecetaPage } from "@/features/recetas/RecetaPage";
import { RecetasPage } from "@/features/recetas/RecetasPage";
import { PantallaLogin } from "@/features/sesion/PantallaLogin";
import { SesionProvider, useSesion } from "@/features/sesion/SesionProvider";

export function App() {
  if (!supabaseConfigurado) return <FaltaConfiguracion />;
  return (
    <SesionProvider>
      <ConSesion />
    </SesionProvider>
  );
}

function ConSesion() {
  const sesion = useSesion();
  if (sesion === undefined) return <Cargando className="min-h-dvh" />;
  if (sesion === null) return <PantallaLogin />;
  return (
    <HogarProvider>
      <BrowserRouter>
        <Routes>
          <Route path="recetas/:id/cocinar" element={<ModoCocinaPage />} />
          <Route element={<Estructura />}>
            <Route index element={<MenuPage />} />
            <Route path="lista" element={<ListaPage />} />
            <Route path="despensa" element={<DespensaPage />} />
            <Route path="escanear" element={<EscanerPage />} />
            <Route path="recetas" element={<RecetasPage />} />
            <Route path="recetas/nueva" element={<EditorRecetaPage />} />
            <Route path="recetas/:id" element={<RecetaPage />} />
            <Route path="recetas/:id/editar" element={<EditorRecetaPage />} />
            <Route path="ajustes" element={<AjustesPage />} />
            <Route path="ajustes/ingredientes" element={<IngredientesPage />} />
            <Route path="ajustes/estadisticas" element={<EstadisticasPage />} />
            <Route path="*" element={<MenuPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HogarProvider>
  );
}

function FaltaConfiguracion() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-2xl font-bold">Falta configurar Supabase</h1>
      <p className="text-suave">
        Copia <code className="rounded bg-superficie-2 px-1">.env.example</code> a <code className="rounded bg-superficie-2 px-1">.env.local</code> y
        rellena <code className="rounded bg-superficie-2 px-1">VITE_SUPABASE_URL</code> y <code className="rounded bg-superficie-2 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        Los pasos completos están en el README.
      </p>
    </main>
  );
}
