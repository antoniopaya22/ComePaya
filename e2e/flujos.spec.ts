import { expect, test } from "@playwright/test";

// Recorridos principales de la app en el modo demo. Cada test parte de los datos de ejemplo.
test.beforeEach(async ({ request, page }) => {
  await request.get("/demo-supabase/__reiniciar");
  // El recorrido guiado sale solo la primera vez; aquí se da por visto salvo en su propio test.
  await page.addInitScript(() => localStorage.setItem("comepaya.recorrido-visto", "1"));
});

test("Hoy muestra el plato del día, lo que caduca y la lista", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Persona");
  await expect(page.getByText("Pollo al horno con patatas").first()).toBeVisible();
  await expect(page.getByText("Caduca pronto")).toBeVisible();
  await expect(page.getByText(/3 por comprar/)).toBeVisible();
});

test("Lista: añadir con cantidad, marcar y ver la sección", async ({ page }) => {
  await page.goto("/lista");
  await page.getByPlaceholder(/Añadir/).fill("2 kg tomates");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  const fila = page.getByRole("button", { name: /Tomate.*2 kg/ });
  await expect(fila).toBeVisible();
  // Reconoce el ingrediente y lo coloca en su sección.
  await expect(page.locator("section", { has: fila }).getByRole("heading")).toContainText("Fruta y verdura");
  await fila.click();
  await expect(fila).toHaveAttribute("aria-pressed", "true");
});

test("Receta: escalar raciones y abrir el modo cocina", async ({ page }) => {
  await page.goto("/recetas");
  await page.getByText("Lentejas con chorizo").click();
  await expect(page.getByText("400 g")).toBeVisible();
  await page.getByRole("button", { name: "Menos" }).first().click();
  await page.getByRole("button", { name: "Menos" }).first().click();
  await expect(page.getByText("200 g")).toBeVisible();
  await page.getByRole("link", { name: /Cocinar/ }).click();
  await expect(page.getByText("2 raciones")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.getByText("Sofríe el chorizo en rodajas.")).toBeVisible();
});

test("Despensa agrupada y ficha de producto", async ({ page }) => {
  await page.goto("/despensa");
  await page.getByText("Leche semidesnatada").first().click();
  await expect(page.getByText("2 lotes")).toBeVisible();
  await page.getByRole("link", { name: /Ver ficha/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leche semidesnatada");
  await expect(page.getByText("Historial")).toBeVisible();
});

test("Menú: planificar una cena con una sugerencia", async ({ page }) => {
  await page.goto("/menu");
  const planificar = page.getByRole("button", { name: /cena\s*Planificar/i }).first();
  await planificar.click();
  await expect(page.getByText("Sugerencias")).toBeVisible();
  await page.getByRole("dialog").getByText("Merluza en salsa verde").first().click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Merluza en salsa verde").first()).toBeVisible();
});

test("Menú: rellenar la semana siguiente con la planificación automática", async ({ page }) => {
  await page.goto("/menu");
  // La semana siguiente está vacía en la demo, así que siempre hay huecos que rellenar.
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await page.getByRole("button", { name: "Rellenar la semana" }).click();
  await page.getByRole("button", { name: /Planificar \d+ comidas/ }).click();
  await expect(page.getByText(/comidas planificadas/)).toBeVisible();
  await expect(page.getByText("Merluza en salsa verde").first()).toBeVisible();
});

test("Despensa: marcar un producto como abierto acorta su caducidad", async ({ page }) => {
  await page.goto("/productos/p-tomate");
  await page.getByRole("button", { name: /2 × 400 g/ }).click();
  await page.getByRole("button", { name: /Lo he abierto/ }).click();
  await expect(page.getByText("Marcado como abierto")).toBeVisible();
  // El envase abierto se separa del cerrado, pasa a la nevera y caduca en 4 días.
  await expect(page.getByRole("button", { name: /400 g\s*Nevera · empezado\s*Caduca en 4 días/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /400 g\s*Despensa/ })).toBeVisible();
});

test("Ajustes: el código de invitación del hogar está visible", async ({ page }) => {
  await page.goto("/ajustes");
  await expect(page.getByText("DEMO2345")).toBeVisible();
  await expect(page.getByText("Otra persona")).toBeVisible();
});

test("Landing: se ve la portada y lleva a la app", async ({ page }) => {
  await page.goto("/bienvenida");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("La cocina de casa");
  await page
    .getByRole("link", { name: /Ir a mi cocina/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
});

test("Buscador: Ctrl+K encuentra una receta y añade lo que no existe a la lista", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Control+k");
  const buscar = page.getByPlaceholder(/Busca recetas/);
  await buscar.fill("lentejas");
  await page.getByRole("option", { name: /Lentejas con chorizo/ }).click();
  await expect(page).toHaveURL(/\/recetas\//);

  await page.keyboard.press("Control+k");
  await buscar.fill("velas de cumpleaños");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/añadido a la lista/)).toBeVisible();
  await page.goto("/lista");
  await expect(page.getByRole("button", { name: "Velas de cumpleaños", exact: true })).toBeVisible();
});

test("Recorrido guiado: sale la primera vez, se recorre y no vuelve a salir", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("ya-cargado")) localStorage.removeItem("comepaya.recorrido-visto");
    sessionStorage.setItem("ya-cargado", "1");
  });
  await page.goto("/");
  const recorrido = page.getByRole("dialog", { name: "Bienvenido a ComePayá" });
  await expect(recorrido).toBeVisible();
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page.getByRole("dialog", { name: "Todo a mano" })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("dialog", { name: "Tu hogar, en familia" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("button", { name: "Terminar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Primeros pasos: en un hogar vacío guían hacia lo siguiente", async ({ page }) => {
  for (const tabla of ["lote_despensa", "receta", "item_lista", "franja_menu"]) {
    await page.route(
      (url) => url.pathname.endsWith(`/rest/v1/${tabla}`),
      (ruta) => (ruta.request().method() === "GET" ? ruta.fulfill({ json: [] }) : ruta.continue()),
    );
  }
  await page.goto("/");
  const tarjeta = page.getByRole("region", { name: "Primeros pasos" });
  await expect(tarjeta).toBeVisible();
  // En la demo hay dos miembros y no hay avisos push: queda 1 de 5.
  await expect(tarjeta.getByText("1 de 5 hechos")).toBeVisible();
  await expect(tarjeta.getByRole("link", { name: /Añade lo que tienes en casa.*Escanear/ })).toHaveAttribute("href", "/escanear");
  await tarjeta.getByRole("button", { name: "Ocultar primeros pasos" }).click();
  await expect(tarjeta).toHaveCount(0);
});

test("Tirar hacia abajo recarga los datos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const deslizar = (tipo: string, y: number) =>
    page.evaluate(
      ([tipo, y]) => {
        const objetivo = document.querySelector("h1")!;
        const toque = new Touch({ identifier: 1, target: objetivo, clientX: 180, clientY: Number(y) });
        const lista = tipo === "touchend" ? [] : [toque];
        objetivo.dispatchEvent(new TouchEvent(String(tipo), { touches: lista, changedTouches: [toque], bubbles: true }));
      },
      [tipo, y],
    );
  await deslizar("touchstart", 150);
  await deslizar("touchmove", 250);
  await deslizar("touchmove", 380);
  await expect(page.getByRole("status", { name: "Suelta para recargar" })).toBeVisible();
  const consulta = page.waitForRequest((r) => r.url().includes("/demo-supabase/rest/v1/"));
  await deslizar("touchend", 380);
  await consulta;
  await expect(page.getByRole("status", { name: /recargar|Recargando/ })).toHaveCount(0);
});

test("Escanear abre sin fallos", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Escanear" }).first().click();
  await expect(page).toHaveURL(/\/escanear$/);
  await expect(page.getByText("Algo ha fallado")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Si una pantalla es de una versión anterior y no se descarga, la app recarga sola", async ({ page }) => {
  let fallado = false;
  // La primera vez falla como si el archivo ya no existiera en el servidor tras publicar una versión nueva.
  await page.route(/EscanerPage/, (ruta) => {
    if (fallado) return ruta.continue();
    fallado = true;
    return ruta.fulfill({ status: 404, body: "" });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const recarga = page.waitForEvent("load");
  await page.getByRole("link", { name: "Escanear" }).first().click();
  await recarga;
  await expect(page).toHaveURL(/\/escanear$/);
  await expect(page.getByRole("heading", { level: 1, name: "Escanear" })).toBeVisible();
  await expect(page.getByText("Algo ha fallado")).toHaveCount(0);
});

test("Despensa: repartir unidades de un lote entre despensa y nevera", async ({ page }) => {
  await page.goto("/productos/p-tomate");
  await page.getByRole("button", { name: /2 × 400 g/ }).click();
  const hoja = page.getByRole("dialog");
  await hoja.getByRole("button", { name: "Menos" }).click();
  await hoja.getByText("Nevera", { exact: true }).click();
  await expect(page.getByText("400 g a nevera")).toBeVisible();
  await expect(page.getByRole("button", { name: /^400 g\s*Nevera/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^400 g\s*Despensa/ })).toBeVisible();
});

test("Producto: cambiar el nombre desde su ficha", async ({ page }) => {
  await page.goto("/productos/p-tomate");
  await page.getByRole("button", { name: "Editar producto" }).click();
  const hoja = page.getByRole("dialog");
  const nombre = hoja.getByRole("textbox").first();
  await nombre.fill("Tomate de bote");
  await hoja.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tomate de bote");
});

test("Despensa: alta rápida de frescos sin código de barras", async ({ page }) => {
  await page.goto("/despensa");
  // El botón flotante (el último «Añadir»; las raciones congeladas tienen otro).
  await page.getByRole("button", { name: "Añadir", exact: true }).last().click();
  const hoja = page.getByRole("dialog");
  await hoja.getByRole("button", { name: /Plátano/ }).click();
  await hoja.getByRole("button", { name: "6 ud", exact: true }).click();
  if (process.env.CAPTURA) await page.screenshot({ path: process.env.CAPTURA });
  await hoja.getByRole("button", { name: "Añadir 6 ud" }).click();
  await expect(page.getByText("6 ud de plátano")).toBeVisible();
  // Sigue abierta para añadir lo siguiente.
  await expect(hoja.getByRole("button", { name: /Plátano/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Plátano").first()).toBeVisible();
});

test("Escáner: si la cámara no lo lee, se puede escribir el código", async ({ page }) => {
  await page.goto("/escanear");
  await page.getByRole("button", { name: /Escribe el código/ }).click();
  const campo = page.getByRole("textbox", { name: "Código de barras" });
  await campo.fill("8402001058012");
  await expect(page.getByText("el código no cuadra")).toBeVisible();
  await expect(page.getByRole("button", { name: "Buscar", exact: true })).toBeDisabled();
  await campo.fill("8402001058011");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Despensa: marcar un producto empezado con lo que queda", async ({ page }) => {
  await page.goto("/productos/p-leche");
  await page.getByRole("button", { name: /2 × 1 l/ }).click();
  await page.getByRole("button", { name: "Queda ½" }).click();
  await expect(page.getByText("Empezado · queda ½")).toBeVisible();
  // Se abre un envase (separado del resto) y lo gastado cuenta como consumido.
  await expect(page.getByRole("button", { name: /500 ml\s*Nevera · empezado, queda ½/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^1 l\s*Despensa/ })).toBeVisible();
});

test("Despensa: filtrar por tipo de alimento y ordenar por tipo", async ({ page }) => {
  await page.goto("/despensa");
  await page.getByRole("button", { name: "Todos los tipos" }).click();
  await page.getByRole("menuitem", { name: /Lácteos y huevos/ }).click();
  await expect(page.getByText("Leche semidesnatada")).toBeVisible();
  await expect(page.getByText("Patatas")).toHaveCount(0);

  await page.getByRole("button", { name: /Lácteos y huevos/ }).click();
  await page.getByRole("menuitem", { name: /^Todos/ }).click();
  await page.getByRole("button", { name: "Ordenar" }).click();
  await page.getByRole("menuitem", { name: "Tipo de alimento" }).click();
  await expect(page.getByRole("heading", { name: /Fruta y verdura/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Lácteos y huevos/ })).toBeVisible();
  if (process.env.CAPTURA) await page.screenshot({ path: process.env.CAPTURA });
});

test("Recetas: unir un ingrediente con un producto de la despensa y marcar básicos", async ({ page }) => {
  await page.goto("/recetas/r-merluza");
  await page.getByRole("button", { name: /Merluza 400 g/ }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByText("No hay en casa")).toBeVisible();
  await hoja.getByRole("searchbox").fill("pollo");
  await hoja.getByRole("button", { name: /Muslos de pollo/ }).click();
  await expect(hoja.getByText(/son lo mismo/)).toBeVisible();
  if (process.env.CAPTURA) await page.screenshot({ path: process.env.CAPTURA });
  await hoja.getByRole("button", { name: "Unir" }).click();
  await expect(page.getByText("«Merluza» unido con «Muslos de pollo»")).toBeVisible();
  // Ahora la receta cuenta lo que hay de ese producto.
  await expect(page.getByRole("button", { name: "Hay en casa Muslos de pollo 400 g" })).toBeVisible();

  await page.getByRole("button", { name: /Perejil 10 g/ }).click();
  await page.getByRole("dialog").getByRole("switch").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Hay en casa Perejil 10 g" })).toBeVisible();
});

test("Menú: comidas propias del bebé y alimentos que aún no ha probado", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByRole("switch", { name: /Menú de bebé/ }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Lucía");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Menú de Lucía activado")).toBeVisible();

  await page.goto("/menu");
  await page.getByRole("button", { name: "comida de Lucía" }).first().click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByRole("heading", { name: /Comida de Lucía/ })).toBeVisible();
  // Solo sus recetas (etiqueta «bebé»).
  await expect(hoja.getByRole("button", { name: /Lentejas con chorizo/ })).toHaveCount(0);
  await hoja
    .getByRole("button", { name: /Puré de verduras/ })
    .last()
    .click();
  await expect(hoja.getByText("Primera vez para Lucía: calabacín.")).toBeVisible();
  if (process.env.CAPTURA) await page.screenshot({ path: process.env.CAPTURA });
  await hoja.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: "comida de Lucía" }).first()).toContainText("Puré de verduras");
  // La casa sigue con sus 14 franjas.
  await expect(page.getByText(/de 14 franjas planificadas/).first()).toBeVisible();

  await page.goto("/ajustes/bebe");
  await expect(page.getByRole("button", { name: /Zanahoria/ })).toContainText(/\d/);
  await page.getByRole("button", { name: /Calabacín.*Ya lo ha probado/ }).click();
  await expect(page.getByText(/Ya probados · 3/)).toBeVisible();
});

test("Ingredientes: pasar a unidades lo que se cuenta por piezas", async ({ page }) => {
  await page.goto("/ajustes/ingredientes");
  await page.getByRole("link", { name: /Cebolla/ }).first().click();
  await page.getByRole("button", { name: "Editar ingrediente" }).click();
  const hoja = page.getByRole("dialog");
  // Simula un hogar antiguo con la cebolla en gramos.
  await hoja.getByRole("radiogroup").getByText("Gramos").click();
  await hoja.getByRole("button", { name: "Guardar" }).click();
  await page.goto("/despensa");
  await expect(page.getByText("Contar por unidades, sin pesar")).toBeVisible();
  await page.getByRole("button", { name: "Pasar a unidades" }).click();
  await expect(page.getByText(/pasa a contarse por unidades/)).toBeVisible();
  await expect(page.getByText("Contar por unidades, sin pesar")).toHaveCount(0);
});
