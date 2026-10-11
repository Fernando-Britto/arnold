/**
 * Validaciones de formato compartidas (T-023b).
 * Son las mismas reglas que usaba el dominio de Cliente: ahora viven acá para
 * que formularios, API y dominio no mantengan copias distintas.
 */

/** Email: algo@dominio.tld, sin espacios. */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** DNI: 8 dígitos, con puntos (XX.XXX.XXX) o sin ellos. */
export function validateDNI(dni: string): boolean {
  return /^\d{2}\.\d{3}\.\d{3}$/.test(dni) || /^\d{8}$/.test(dni);
}

/** Teléfono móvil argentino: +54 9 XXXX XXXXXX. */
export function validatePhone(phone: string): boolean {
  return /^\+54\s9\s\d{4}\s\d{6}$/.test(phone);
}
