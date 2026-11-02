import { describe, expect, it, vi } from "vitest";
import { buscarEnMercadona, buscarEnMercadonaPorEan, idMercadonaDesdeEan, normalizarDetalleMercadona, normalizarHitMercadona, obtenerProductoMercadona } from "./mercadona.js";

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
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ hits: [{ id: 7, display_name: "Leche" }] })));
    const resultados = await buscarEnMercadona("leche", fetchFn);
    // Se consulta en cada almacén y no se repite lo que sale en varios.
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(resultados.map((r) => r.mercadona_id)).toEqual(["7"]);
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({ query: "leche", hitsPerPage: 8 });
  });

  it("lanza si el servicio falla", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => new Response("", { status: 403 }));
    await expect(buscarEnMercadona("leche", fetchFn)).rejects.toThrow("403");
  });

  it("junta lo que solo hay en algunos almacenes", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      String(url).includes("_vlc1_")
        ? new Response(JSON.stringify({ hits: [{ id: 1, display_name: "Nachos 150 g" }] }))
        : String(url).includes("_mad1_")
          ? new Response(JSON.stringify({ hits: [{ id: 2, display_name: "Nachos 200 g" }, { id: 1, display_name: "Nachos 150 g" }] }))
          : new Response("", { status: 500 }),
    );
    expect((await buscarEnMercadona("nachos", fetchFn)).map((r) => r.nombre)).toEqual(["Nachos 150 g", "Nachos 200 g"]);
  });
});

describe("productos de Mercadona por código de barras", () => {
  it("saca el id de Mercadona de los códigos Hacendado", () => {
    expect(idMercadonaDesdeEan("8480000336408")).toBe("33640");
    expect(idMercadonaDesdeEan("8480000016387")).toBe("1638");
    expect(idMercadonaDesdeEan("8402001058011")).toBeNull();
  });

  it("busca la ficha en el almacén donde existe", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      String(url).endsWith("wh=mad1") ? new Response(JSON.stringify({ id: "17754", display_name: "Nachos Hacendado", ean: "8402001058011" })) : new Response("", { status: 404 }),
    );
    const producto = await obtenerProductoMercadona("17754", fetchFn);
    expect(producto?.ean).toBe("8402001058011");
    expect(await obtenerProductoMercadona("1", vi.fn<typeof fetch>().mockImplementation(async () => new Response("", { status: 404 })))).toBeNull();
  });

  it("solo acepta la ficha si tiene exactamente ese código", async () => {
    const ficha = (ean: string) => vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ id: "33640", display_name: "Nachos Hacendado", ean })));
    expect((await buscarEnMercadonaPorEan("8480000336408", ficha("8480000336408")))?.nombre).toBe("Nachos Hacendado");
    expect(await buscarEnMercadonaPorEan("8480000336408", ficha("8480000999999"))).toBeNull();
    // Código de otro fabricante que está en la lista de conocidos.
    expect((await buscarEnMercadonaPorEan("8402001058011", ficha("8402001058011")))?.ean).toBe("8402001058011");
    // Ni Hacendado ni conocido: no se consulta nada.
    const nada = vi.fn<typeof fetch>();
    expect(await buscarEnMercadonaPorEan("5000112548167", nada)).toBeNull();
    expect(nada).not.toHaveBeenCalled();
  });
});
