import { describe, expect, it } from "vitest";
import { esIpPrivada, urlPublica } from "./red.js";

describe("esIpPrivada", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1",
    // IPv4 escondidas en IPv6: la URL las normaliza a hexadecimal.
    "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:c0a8:101", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::1", "::127.0.0.1", "::",
    "fec0::1", "ff02::1", "64:ff9b:1::1", "2001:db8::1"])(
    "%s es privada",
    (ip) => expect(esIpPrivada(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:808:808", "64:ff9b::808:808", "2a00:1450:4003:80b::200e"])("%s es pública", (ip) => expect(esIpPrivada(ip)).toBe(false));
});

describe("urlPublica", () => {
  const resolverA = (ip: string) => (async () => [{ address: ip, family: 4 }]) as never;

  it("acepta webs públicas", async () => {
    expect((await urlPublica("https://recetas.example/lentejas", resolverA("93.184.216.34")))?.hostname).toBe("recetas.example");
  });

  it("rechaza dominios que resuelven a la red interna", async () => {
    expect(await urlPublica("https://127.0.0.1.nip.io/", resolverA("127.0.0.1"))).toBeNull();
  });

  it.each(["http://localhost:3000", "http://localhost./x", "http://[::1]/", "http://192.168.1.10/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:a9fe:a9fe]/", "http://[64:ff9b::a9fe:a9fe]/", "ftp://example.com/", "https://usuario:clave@example.com/", "no es una url"])(
    "rechaza %s",
    async (url) => expect(await urlPublica(url, resolverA("93.184.216.34"))).toBeNull(),
  );
});
