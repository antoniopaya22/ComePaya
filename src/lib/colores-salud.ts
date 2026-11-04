// Colores oficiales de Nutri-Score y NOVA, y el texto que se lee bien encima de cada uno (blanco sobre amarillo no se ve).
const OSCURO = "#1d2420";

export const COLOR_NUTRISCORE = { a: "#038141", b: "#85bb2f", c: "#fecb02", d: "#ee8100", e: "#e63e11" } as const;
export const TEXTO_NUTRISCORE = { a: "#ffffff", b: OSCURO, c: OSCURO, d: OSCURO, e: "#ffffff" } as const;

export const COLOR_NOVA = { 1: "#00aa00", 2: "#ffcc00", 3: "#ff6600", 4: "#ff0000" } as const;
export const TEXTO_NOVA_COLOR = { 1: OSCURO, 2: OSCURO, 3: OSCURO, 4: "#ffffff" } as const;
