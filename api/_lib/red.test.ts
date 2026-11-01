import { describe, expect, it } from "vitest";
import { esIpPrivada, urlPublica } from "./red";

describe("esIpPrivada", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"])(
    "%s es privada",
    (ip) => expect(esIpPrivada(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::1111"])("%s es pública", (ip) => expect(esIpPrivada(ip)).toBe(false));
});

describe("urlPublica", () => {
  const resolverA = (ip: string) => (async () => [{ address: ip, family: 4 }]) as never;

  it("acepta webs públicas", async () => {
    expect((await urlPublica("https://recetas.example/lentejas", resolverA("93.184.216.34")))?.hostname).toBe("recetas.example");
  });

  it("rechaza dominios que resuelven a la red interna", async () => {
    expect(await urlPublica("https://127.0.0.1.nip.io/", resolverA("127.0.0.1"))).toBeNull();
  });

  it.each(["http://localhost:3000", "http://localhost./x", "http://[::1]/", "http://192.168.1.10/", "ftp://example.com/", "https://usuario:clave@example.com/", "no es una url"])(
    "rechaza %s",
    async (url) => expect(await urlPublica(url, resolverA("93.184.216.34"))).toBeNull(),
  );
});
