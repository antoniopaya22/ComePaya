import { describe, expect, it } from "vitest";
import { eanValido } from "./ean";

describe("eanValido", () => {
  it.each(["8410188012092", "4006381333931", "96385074", "036000291452", "5449000000996"])("acepta %s", (codigo) => {
    expect(eanValido(codigo)).toBe(true);
  });

  it.each(["8410188012093", "4006381333930", "96385075", "123", "84101880120921234", "abcdefghijklm", ""])("rechaza %s", (codigo) => {
    expect(eanValido(codigo)).toBe(false);
  });
});
