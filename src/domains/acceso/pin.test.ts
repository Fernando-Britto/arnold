/**
 * PIN de acceso (D-47): exactamente 4 dígitos, con ceros a la izquierda permitidos.
 * Vive en el dominio porque lo usan el servicio de acceso y el alta de socios.
 */
import { validarPin } from "./pin";

describe("validarPin", () => {
  it.each(["0000", "1234", "9999"])("acepta %s", (pin) => {
    expect(validarPin(pin)).toBe(true);
  });

  it.each(["", "123", "12345", "12a4", "12 4", "abcd", "12.4", " 1234", null, undefined, 1234])(
    "rechaza %p",
    (pin) => {
      expect(validarPin(pin)).toBe(false);
    }
  );
});
