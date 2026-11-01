/**
 * Comprueba el dígito de control de un EAN-8, UPC-A (12), EAN-13 o GTIN-14.
 * Descarta lecturas erróneas antes de consultar fuera.
 */
export function eanValido(codigo: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(codigo)) return false;
  const digitos = [...codigo].map(Number);
  const control = digitos.pop()!;
  // Desde la derecha, los dígitos alternan peso 3 y 1.
  const suma = digitos.reverse().reduce((total, d, i) => total + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === control;
}
