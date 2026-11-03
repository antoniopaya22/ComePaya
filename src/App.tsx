import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Estructura } from "@/components/Estructura";
import { FalloPantalla } from "@/components/FalloPantalla";
import { Cargando } from "@/components/ui/varios";
import { supabaseConfigurado } from "@/lib/supabase";
import { HogarProvider } from "@/features/hogar/HogarProvider";
import { HoyPage } from "@/features/hoy/HoyPage";
import { SesionProvider, useSesion } from "@/features/sesion/SesionProvider";

// Solo Hoy va en el arranque; el resto de pantallas se descarga al abrirla. Las pestañas principales
// se precargan en cuanto la app está en reposo, para que al tocarlas abran al instante.
const cargar = {
  menu: () => import("@/features/menu/MenuPage"),
  lista: () => import("@/features/lista/ListaPage"),
  despensa: () => import("@/features/despensa/DespensaPage"),
  recetas: () => import("@/features/recetas/RecetasPage"),
  receta: () => import("@/features/recetas/RecetaPage"),
  producto: () => import("@/features/productos/ProductoPage"),
};
const MenuPage = lazy(() => cargar.menu().then((m) => ({ default: m.MenuPage })));
const ListaPage = lazy(() => cargar.lista().then((m) => ({ default: m.ListaPage })));
const DespensaPage = lazy(() => cargar.despensa().then((m) => ({ default: m.DespensaPage })));
const RecetasPage = lazy(() => cargar.recetas().then((m) => ({ default: m.RecetasPage })));
const RecetaPage = lazy(() => cargar.receta().then((m) => ({ default: m.RecetaPage })));
const ProductoPage = lazy(() => cargar.producto().then((m) => ({ default: m.ProductoPage })));
const ProductosPage = lazy(() => import("@/features/productos/ProductosPage").then((m) => ({ default: m.ProductosPage })));
const IngredientePage = lazy(() => import("@/features/productos/IngredientePage").then((m) => ({ default: m.IngredientePage })));
const AjustesPage = lazy(() => import("@/features/ajustes/AjustesPage").then((m) => ({ default: m.AjustesPage })));
const IngredientesPage = lazy(() => import("@/features/ajustes/IngredientesPage").then((m) => ({ default: m.IngredientesPage })));
const LandingPage = lazy(() => import("@/features/landing/LandingPage").then((m) => ({ default: m.LandingPage })));
const PantallaLogin = lazy(() => import("@/features/sesion/PantallaLogin").then((m) => ({ default: m.PantallaLogin })));
const EscanerPage = lazy(() => import("@/features/escaner/EscanerPage").then((m) => ({ default: m.EscanerPage })));
const ModoCocinaPage = lazy(() => import("@/features/cocina/ModoCocinaPage").then((m) => ({ default: m.ModoCocinaPage })));
const EditorRecetaPage = lazy(() => import("@/features/recetas/EditorRecetaPage").then((m) => ({ default: m.EditorRecetaPage })));
const AlimentosBebePage = lazy(() => import("@/features/ajustes/AlimentosBebePage").then((m) => ({ default: m.AlimentosBebePage })));
const EstadisticasPage = lazy(() => import("@/features/ajustes/EstadisticasPage").then((m) => ({ default: m.EstadisticasPage })));

function precargarPestanas() {
  const precargar = () => Object.values(cargar).forEach((f) => f().catch(() => {}));
  if ("requestIdleCallback" in window) requestIdleCallback(precargar, { timeout: 3000 });
  else setTimeout(precargar, 1500);
}

export function App() {
  if (!supabaseConfigurado) return <FaltaConfiguracion />;
  return (
    <BrowserRouter>
      {/* Último recurso: si falla algo fuera de las pantallas (barras, buscador, hogar), aviso en vez de pantalla en blanco. */}
      <FalloPantalla>
        <SesionProvider>
          <Routes>
            {/* La landing se puede ver también con sesión iniciada. */}
            <Route
              path="bienvenida"
              element={
                <Diferida>
                  <LandingPage />
                </Diferida>
              }
            />
            <Route path="*" element={<ConSesion />} />
          </Routes>
        </SesionProvider>
      </FalloPantalla>
    </BrowserRouter>
  );
}

function ConSesion() {
  const sesion = useSesion();
  if (sesion === undefined) return <Cargando className="min-h-dvh" />;
  if (sesion === null) {
    return (
      <Diferida>
        <Routes>
          <Route path="entrar" element={<PantallaLogin />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Diferida>
    );
  }
  return <ConHogar />;
}

function ConHogar() {
  useEffect(precargarPestanas, []);
  return (
    <HogarProvider>
      <Routes>
        <Route path="entrar" element={<Navigate to="/" replace />} />
        <Route
          path="recetas/:id/cocinar"
          element={
            <FalloPantalla>
              <Suspense fallback={<Cargando className="min-h-dvh" />}>
                <ModoCocinaPage />
              </Suspense>
            </FalloPantalla>
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

/** Mientras se descarga una pantalla fuera de la estructura (landing, login). */
function Diferida({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Cargando className="min-h-dvh" />}>{children}</Suspense>;
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
