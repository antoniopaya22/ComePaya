import { describe, expect, it, vi } from "vitest";
import { buscarEnOpenFoodFacts, normalizarProductoOFF } from "./openfoodfacts";

describe("normalizarProductoOFF", () => {
  it("normaliza una ficha completa", () => {
    const producto = normalizarProductoOFF("8410188012092", {
      product_name: "Tomato frito",
      product_name_es: "Tomate frito",
      brands: "Hacendado, Mercadona",
      quantity: "400 g",
      product_quantity: "400",
      product_quantity_unit: "g",
      image_front_url: "https://images.openfoodfacts.org/x.jpg",
      nutriments: {
        "energy-kcal_100g": 78,
        fat_100g: "3,2",
        "saturated-fat_100g": 0.4,
        sugars_100g: 6.5,
        salt_100g: 1.1,
        proteins_100g: 1.5,
      },
      nutriscore_grade: "c",
      nova_group: 3,
      nutrient_levels: { fat: "moderate", "saturated-fat": "low", sugars: "moderate", salt: "high" },
      additives_tags: ["en:e330", "en:e1422"],
    });

    expect(producto).toMatchObject({
      nombre: "Tomate frito",
      marca: "Hacendado",
      cantidad_texto: "400 g",
      cantidad_envase: 400,
      unidad_envase: "g",
      nutriscore: "c",
      nova: 3,
      niveles_nutrientes: { grasa: "moderado", saturadas: "bajo", azucares: "moderado", sal: "alto" },
      aditivos: ["E330", "E1422"],
      completitud_datos: 1,
      fuente: "openfoodfacts",
    });
    expect(producto.nutrientes_100).toEqual({ kcal: 78, grasa: 3.2, saturadas: 0.4, azucares: 6.5, sal: 1.1, proteina: 1.5 });
  });

  it("no inventa datos cuando la ficha está incompleta", () => {
    const producto = normalizarProductoOFF("12345678", {
      product_name: "  ",
      nutriscore_grade: "unknown",
      nova_group: "",
    });
    expect(producto).toMatchObject({
      nombre: null,
      marca: null,
      nutriscore: null,
      nova: null,
      nutrientes_100: null,
      niveles_nutrientes: null,
      cantidad_envase: null,
      completitud_datos: 0,
    });
  });

  it("convierte la unidad del envase a la unidad base", () => {
    expect(normalizarProductoOFF("12345678", { product_quantity: 1000, product_quantity_unit: "ml" })).toMatchObject({
      cantidad_envase: 1000,
      unidad_envase: "ml",
    });
  });
});

describe("buscarEnOpenFoodFacts", () => {
  const respuesta = (cuerpo: unknown, status = 200) =>
    vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status }));

  it("devuelve null si el producto no existe", async () => {
    expect(await buscarEnOpenFoodFacts("12345678", respuesta({ status: 0 }))).toBeNull();
    expect(await buscarEnOpenFoodFacts("12345678", respuesta({}, 404))).toBeNull();
  });

  it("lanza si el servicio falla, para no confundirlo con un producto inexistente", async () => {
    await expect(buscarEnOpenFoodFacts("12345678", respuesta({}, 503))).rejects.toThrow("503");
  });

  it("envía un User-Agent propio", async () => {
    const fetchFn = respuesta({ status: 1, product: { product_name: "Leche" } });
    const producto = await buscarEnOpenFoodFacts("12345678", fetchFn);
    expect(producto?.nombre).toBe("Leche");
    const cabeceras = fetchFn.mock.calls[0][1]?.headers as Record<string, string>;
    expect(cabeceras["User-Agent"]).toMatch(/^Despensa\//);
  });
});
