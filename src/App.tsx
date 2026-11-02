import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Estructura } from "@/components/Estructura";
import { Cargando } from "@/components/ui/varios";
import { supabaseConfigurado } from "@/lib/supabase";
import { AjustesPage } from "@/features/ajustes/AjustesPage";
import { IngredientesPage } from "@/features/ajustes/IngredientesPage";
import { DespensaPage } from "@/features/despensa/DespensaPage";
import { HogarProvider } from "@/features/hogar/HogarProvider";
import { HoyPage } from "@/features/hoy/HoyPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { ListaPage } from "@/features/lista/ListaPage";
import { MenuPage } from "@/features/menu/MenuPage";
import { IngredientePage } from "@/features/productos/IngredientePage";
import { ProductoPage } from "@/features/productos/ProductoPage";
import { ProductosPage } from "@/features/productos/ProductosPage";
import { RecetaPage } from "@/features/recetas/RecetaPage";
import { RecetasPage } from "@/features/recetas/RecetasPage";
import { PantallaLogin } from "@/features/sesion/PantallaLogin";
import { SesionProvider, useSesion } from "@/features/sesion/SesionProvider";

// Pantallas que se usan de vez en cuando: se descargan al abrirlas para que el arranque sea más rápido.
const EscanerPage = lazy(() => import("@/features/escaner/EscanerPage").then((m) => ({ default: m.EscanerPage })));
const ModoCocinaPage = lazy(() => import("@/features/cocina/ModoCocinaPage").then((m) => ({ default: m.ModoCocinaPage })));
const EditorRecetaPage = lazy(() => import("@/features/recetas/EditorRecetaPage").then((m) => ({ default: m.EditorRecetaPage })));
const AlimentosBebePage = lazy(() => import("@/features/ajustes/AlimentosBebePage").then((m) => ({ default: m.AlimentosBebePage })));
const EstadisticasPage = lazy(() => import("@/features/ajustes/EstadisticasPage").then((m) => ({ default: m.EstadisticasPage })));

export function App() {
  if (!supabaseConfigurado) return <FaltaConfiguracion />;
  return (
    <BrowserRouter>
      <SesionProvider>
        <Routes>
          {/* La landing se puede ver también con sesión iniciada. */}
          <Route path="bienvenida" element={<LandingPage />} />
          <Route path="*" element={<ConSesion />} />
        </Routes>
      </SesionProvider>
    </BrowserRouter>
  );
}

function ConSesion() {
  const sesion = useSesion();
  if (sesion === undefined) return <Cargando className="min-h-dvh" />;
  if (sesion === null) {
    return (
      <Routes>
        <Route path="entrar" element={<PantallaLogin />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }
  return (
    <HogarProvider>
      <Routes>
        <Route path="entrar" element={<Navigate to="/" replace />} />
        <Route
          path="recetas/:id/cocinar"
          element={
            <Suspense fallback={<Cargando className="min-h-dvh" />}>
              <ModoCocinaPage />
            </Suspense>
          }
        />
        <Route element={<Estructura />}>
          <Route index element={<HoyPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="lista" element={<ListaPage />} />
          <Route path="despensa" element={<DespensaPage />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="productos/:id" element={<ProductoPage />} />
          <Route path="ingredientes/:id" element={<IngredientePage />} />
          <Route path="escanear" element={<EscanerPage />} />
          <Route path="recetas" element={<RecetasPage />} />
          <Route path="recetas/nueva" element={<EditorRecetaPage />} />
          <Route path="recetas/:id" element={<RecetaPage />} />
          <Route path="recetas/:id/editar" element={<EditorRecetaPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="ajustes/ingredientes" element={<IngredientesPage />} />
          <Route path="ajustes/estadisticas" element={<EstadisticasPage />} />
          <Route path="ajustes/bebe" element={<AlimentosBebePage />} />
          <Route path="*" element={<HoyPage />} />
        </Route>
      </Routes>
    </HogarProvider>
  );
}

function FaltaConfiguracion() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-2xl font-bold">Falta configurar Supabase</h1>
      <p className="text-suave">
        Copia <code className="rounded bg-superficie-2 px-1">.env.example</code> a <code className="rounded bg-superficie-2 px-1">.env.local</code> y
        rellena <code className="rounded bg-superficie-2 px-1">VITE_SUPABASE_URL</code> y{" "}
        <code className="rounded bg-superficie-2 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code>. Los pasos completos están en el README.
      </p>
    </main>
  );
}
