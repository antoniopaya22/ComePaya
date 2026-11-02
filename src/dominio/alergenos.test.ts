import { describe, expect, it } from "vitest";
import { abrirEnvase, alergenosDeIngrediente, alergenosDeReceta, conflictos, filtrarAlergenos } from "./alergenos.js";

describe("alérgenos", () => {
  it("se queda con los 14 oficiales y sin repetir", () => {
    expect(filtrarAlergenos(["en:milk", "en:gluten", "en:milk", "en:pork", "fr:lait"])).toEqual(["en:milk", "en:gluten"]);
    expect(filtrarAlergenos(null)).toEqual([]);
  });

  it("un ingrediente suma los suyos y los de sus productos", () => {
    expect(alergenosDeIngrediente(["en:gluten"], [["en:milk"], null, ["en:gluten", "en:soybeans"]])).toEqual(["en:gluten", "en:milk", "en:soybeans"]);
  });

  it("separa lo que lleva seguro de lo que solo está en opcionales", () => {
    expect(
      alergenosDeReceta([
        { opcional: false, alergenos: ["en:milk"] },
        { opcional: true, alergenos: ["en:milk", "en:nuts"] },
        { opcional: false, alergenos: ["en:gluten"] },
      ]),
    ).toEqual({ contiene: ["en:gluten", "en:milk"], opcionales: ["en:nuts"] });
  });

  it("detecta los que afectan al hogar", () => {
    expect(conflictos(["en:gluten", "en:milk"], ["en:milk", "en:fish"])).toEqual(["en:milk"]);
    expect(conflictos(["en:gluten"], [])).toEqual([]);
  });
});

describe("abrirEnvase", () => {
  const hoy = "2026-11-01";

  it("abre el único envase y acorta la caducidad", () => {
    expect(abrirEnvase({ id: "l", cantidad: 1000, fecha_caducidad: "2027-03-01" }, 1000, 4, hoy)).toEqual({
      abierto: { id: "l", cantidad: 1000, fecha_caducidad: "2026-11-05", abierto_en: hoy },
      restoCerrado: null,
    });
  });

  it("separa un envase de un lote de varios", () => {
    expect(abrirEnvase({ id: "l", cantidad: 3000, fecha_caducidad: "2027-03-01" }, 1000, 4, hoy)).toEqual({
      abierto: { id: null, cantidad: 1000, fecha_caducidad: "2026-11-05", abierto_en: hoy },
      restoCerrado: { id: "l", cantidad: 2000 },
    });
  });

  it("respeta la fecha impresa si es anterior y la pone si no había", () => {
    expect(abrirEnvase({ id: "l", cantidad: 500, fecha_caducidad: "2026-11-02" }, 500, 4, hoy).abierto.fecha_caducidad).toBe("2026-11-02");
    expect(abrirEnvase({ id: "l", cantidad: 500, fecha_caducidad: null }, 500, 4, hoy).abierto.fecha_caducidad).toBe("2026-11-05");
  });

  it("sin días tras abrir conserva la fecha", () => {
    expect(abrirEnvase({ id: "l", cantidad: 500, fecha_caducidad: "2027-01-01" }, null, null, hoy).abierto.fecha_caducidad).toBe("2027-01-01");
  });
});
