/**
 * PIN de acceso (D-47): exactamente 4 dígitos, con ceros a la izquierda permitidos.
 * Vive en el dominio porque lo usan tanto el servicio de acceso (check-in / definir PIN)
 * como el alta y edición de socios (para guardarlo hasheado).
 */
const PIN_RE = /^\d{4}$/;

/** PIN válido: exactamente 4 dígitos. */
export function validarPin(pin: unknown): pin is string {
  return typeof pin === "string" && PIN_RE.test(pin);
}
