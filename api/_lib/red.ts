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
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapeada) return esIpPrivada(mapeada[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
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
