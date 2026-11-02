import { describe, expect, it } from "vitest";
import { datosBaseDe, pendientesDePasarAUnidades } from "./ingredientes-base.js";

describe("fruta y verdura por unidades", () => {
  it("lo que se cuenta por piezas viene en unidades, con su peso", () => {
    expect(datosBaseDe("Patata")).toMatchObject({ unidad_base: "ud", peso_unidad_g: 200 });
    expect(datosBaseDe("cebolla")).toMatchObject({ unidad_base: "ud", peso_unidad_g: 150 });
    expect(datosBaseDe("Calabacín")).toMatchObject({ unidad_base: "ud" });
    // Lo que se compra suelto o en bandeja sigue en peso.
    expect(datosBaseDe("Espinacas")).toMatchObject({ unidad_base: "g" });
  });

  it("detecta los del hogar que siguen en gramos", () => {
    const ingredientes = [
      { nombre: "Patata", unidad_base: "g" as const, peso_unidad_g: null },
      { nombre: "Cebolla", unidad_base: "ud" as const, peso_unidad_g: 150 },
      { nombre: "Lentejas", unidad_base: "g" as const, peso_unidad_g: null },
      { nombre: "Espinacas", unidad_base: "g" as const, peso_unidad_g: null },
    ];
    expect(pendientesDePasarAUnidades(ingredientes).map((p) => [p.ingrediente.nombre, p.peso])).toEqual([["Patata", 200]]);
  });
});
