import { describe, expect, it, vi } from "vitest";
import { buscarEnMercadona, normalizarDetalleMercadona, normalizarHitMercadona } from "./mercadona";

describe("normalizarHitMercadona", () => {
  it("convierte el envase a la unidad base", () => {
    expect(
      normalizarHitMercadona({
        id: "16044",
        display_name: "Tomate triturado Hacendado",
        brand: "Hacendado",
        packaging: "Bote",
        thumbnail: "https://prod-mercadona.imgix.net/x.jpg",
        price_instructions: { unit_size: 0.4, size_format: "kg", unit_price: "0.55" },
      }),
    ).toEqual({
      mercadona_id: "16044",
      nombre: "Tomate triturado Hacendado",
      marca: "Hacendado",
      envase_texto: "Bote 0,4 kg",
      cantidad_envase: 400,
      unidad_envase: "g",
      foto_url: "https://prod-mercadona.imgix.net/x.jpg",
      precio: 0.55,
    });
  });

  it.each([
    [1, "l", 1000, "ml"],
    [33, "cl", 330, "ml"],
    [250, "g", 250, "g"],
    [12, "ud", null, null],
  ] as const)("%s %s → %s %s", (unit_size, size_format, cantidad, unidad) => {
    const r = normalizarHitMercadona({ id: "1", display_name: "X", price_instructions: { unit_size, size_format } });
    expect([r.cantidad_envase, r.unidad_envase]).toEqual([cantidad, unidad]);
  });

  it("tolera datos que faltan", () => {
    expect(normalizarHitMercadona({ id: "1", display_name: " Pan " })).toMatchObject({
      nombre: "Pan",
      marca: null,
      envase_texto: null,
      cantidad_envase: null,
      foto_url: null,
      precio: null,
    });
  });
});

describe("normalizarDetalleMercadona", () => {
  it("toma la foto grande y el código de barras", () => {
    expect(
      normalizarDetalleMercadona({
        id: "16044",
        ean: "8402001001536",
        display_name: "Tomate triturado Hacendado",
        brand: "Hacendado",
        packaging: "Bote",
        photos: [{ regular: "https://prod-mercadona.imgix.net/g.jpg" }],
        price_instructions: { unit_size: 0.4, size_format: "kg", unit_price: "0.55" },
      }),
    ).toMatchObject({ ean: "8402001001536", foto_url: "https://prod-mercadona.imgix.net/g.jpg", cantidad_envase: 400 });
  });

  it("descarta códigos no válidos", () => {
    expect(normalizarDetalleMercadona({ id: "1", display_name: "X", ean: "abc" }).ean).toBeNull();
  });
});

describe("buscarEnMercadona", () => {
  it("devuelve los resultados normalizados", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ hits: [{ id: 7, display_name: "Leche" }] })));
    const resultados = await buscarEnMercadona("leche", fetchFn);
    expect(resultados.map((r) => r.mercadona_id)).toEqual(["7"]);
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({ query: "leche", hitsPerPage: 8 });
  });

  it("lanza si el servicio falla", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 403 }));
    await expect(buscarEnMercadona("leche", fetchFn)).rejects.toThrow("403");
  });
});
