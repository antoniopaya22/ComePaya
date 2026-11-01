import { expect, test } from "@playwright/test";

// Recorridos principales de la app en el modo demo. Cada test parte de los datos de ejemplo.
test.beforeEach(async ({ request, page }) => {
  await request.get("/demo-supabase/__reiniciar");
  await page.addInitScript(() => localStorage.removeItem("despensa.cache"));
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
  await expect(page.getByRole("button", { name: /400 g\s*Nevera\s*Caduca en 4 días/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /400 g\s*Despensa/ })).toBeVisible();
});

test("Ajustes: el código de invitación del hogar está visible", async ({ page }) => {
  await page.goto("/ajustes");
  await expect(page.getByText("DEMO2345")).toBeVisible();
  await expect(page.getByText("Otra persona")).toBeVisible();
});
