import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Peticiones a URLs que escribe el usuario (importar recetas) sin que sirvan para llegar a la red interna (SSRF).

/** Direcciones que nunca se deben visitar: loopback, privadas, link-local, CGNAT, multicast… */
export function esIpPrivada(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const bytes = bytesIPv6(ip);
  if (!bytes) return true;
  const empieza = (prefijo: number[]) => prefijo.every((b, i) => bytes[i] === b);
  const ceros = (hasta: number) => bytes.slice(0, hasta).every((b) => b === 0);
  const ipv4 = (desde: number) => bytes.slice(desde, desde + 4).join(".");
  // Formas que llevan una IPv4 dentro: se mira esa IPv4 (::ffff:7f00:1 es 127.0.0.1).
  if (ceros(10) && bytes[10] === 0xff && bytes[11] === 0xff) return esIpPrivada(ipv4(12)); // ::ffff:0:0/96
  if (ceros(12)) return true; // ::, ::1 y las IPv4 compatibles (::a.b.c.d, obsoletas)
  if (empieza([0x00, 0x64, 0xff, 0x9b]) && bytes.slice(4, 12).every((b) => b === 0)) return esIpPrivada(ipv4(12)); // 64:ff9b::/96 (NAT64)
  if (empieza([0x20, 0x02])) return esIpPrivada(ipv4(2)); // 2002::/16 (6to4)
  return (
    (bytes[0] & 0xfe) === 0xfc || // fc00::/7 privadas
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) || // fe80::/10 link-local
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) || // fec0::/10 site-local
    bytes[0] === 0xff || // multicast
    empieza([0x00, 0x64, 0xff, 0x9b, 0x00, 0x01]) || // 64:ff9b:1::/48 NAT64 local
    empieza([0x01, 0x00, 0, 0, 0, 0, 0, 0]) || // 100::/64 descarte
    empieza([0x20, 0x01, 0x0d, 0xb8]) // 2001:db8::/32 documentación
  );
}

/** Los 16 bytes de una IPv6 (admite "::" y una IPv4 al final), o null si no lo es. */
function bytesIPv6(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null;
  let texto = ip.toLowerCase().split("%")[0];
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(texto);
  if (v4) {
    const [a, b, c, d] = v4[1].split(".").map(Number);
    texto = texto.slice(0, -v4[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [izquierda, derecha] = texto.split("::");
  const grupos = (t: string | undefined) => (t ? t.split(":").filter(Boolean) : []);
  const ini = grupos(izquierda);
  const fin = derecha === undefined ? [] : grupos(derecha);
  const todos = derecha === undefined ? ini : [...ini, ...Array(8 - ini.length - fin.length).fill("0"), ...fin];
  if (todos.length !== 8) return null;
  return todos.flatMap((g) => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 0xff];
  });
}

/** Valida una URL: http(s), sin credenciales y con un host que resuelva solo a direcciones públicas. */
export async function urlPublica(texto: string, resolver = lookup): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (isIP(host)) return esIpPrivada(host) ? null : url;
  try {
    const direcciones = await resolver(host, { all: true });
    if (!direcciones.length || direcciones.some((d) => esIpPrivada(d.address))) return null;
  } catch {
    return null;
  }
  return url;
}

/**
 * GET siguiendo como mucho 5 redirecciones, validando cada destino, y leyendo como mucho `maxBytes`.
 * (Queda una ventana teórica de DNS rebinding entre la comprobación y la conexión; para leer recetas es aceptable.)
 */
export async function leerUrlPublica(inicial: URL, maxBytes: number, cabeceras: Record<string, string>): Promise<{ status: number; texto: string }> {
  let url = inicial;
  for (let saltos = 0; saltos <= 5; saltos++) {
    const respuesta = await fetch(url, { headers: cabeceras, redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (respuesta.status >= 300 && respuesta.status < 400 && respuesta.headers.get("location")) {
      const siguiente = await urlPublica(new URL(respuesta.headers.get("location")!, url).toString());
      if (!siguiente) throw new Error("La web redirige a una dirección no permitida");
      url = siguiente;
      continue;
    }
    if (!respuesta.body) return { status: respuesta.status, texto: "" };
    const lector = respuesta.body.getReader();
    const trozos: Uint8Array[] = [];
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value);
      total += value.byteLength;
    }
    await lector.cancel().catch(() => {});
    const unido = new Uint8Array(Math.min(total, maxBytes));
    let posicion = 0;
    for (const t of trozos) {
      const parte = t.subarray(0, Math.min(t.byteLength, unido.byteLength - posicion));
      unido.set(parte, posicion);
      posicion += parte.byteLength;
      if (posicion >= unido.byteLength) break;
    }
    return { status: respuesta.status, texto: new TextDecoder().decode(unido) };
  }
  throw new Error("Demasiadas redirecciones");
}
