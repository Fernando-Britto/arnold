/**
 * Elección del ID de huella libre (T-041, D-43/D-47). Función pura: sin Prisma ni React.
 *
 * El sensor maneja un espacio de IDs acotado (`HUELLA_ID_MIN`..`HUELLA_ID_MAX`). Arnold reserva
 * uno libre al enrolar; si está lleno, no se puede asignar ninguno.
 */
import {
  elegirHuellaIdLibre,
  HUELLA_CONFIANZA_MINIMA,
  HUELLA_ID_MAX,
  HUELLA_ID_MIN,
} from "./huella";

describe("constantes de huella", () => {
  it("expone el rango de IDs y la confianza mínima del diseño", () => {
    expect(HUELLA_ID_MIN).toBe(1);
    expect(HUELLA_ID_MAX).toBe(1000);
    expect(HUELLA_CONFIANZA_MINIMA).toBe(50);
  });
});

describe("elegirHuellaIdLibre", () => {
  it("devuelve el primer ID cuando no hay ninguno usado", () => {
    expect(elegirHuellaIdLibre([])).toBe(HUELLA_ID_MIN);
  });

  it("devuelve el siguiente ID cuando los primeros están ocupados", () => {
    expect(elegirHuellaIdLibre([1])).toBe(2);
    expect(elegirHuellaIdLibre([1, 2, 3])).toBe(4);
  });

  it("rellena el primer hueco, no el final", () => {
    expect(elegirHuellaIdLibre([1, 3, 4])).toBe(2);
  });

  it("ignora duplicados y valores fuera de rango", () => {
    expect(elegirHuellaIdLibre([1, 1, 0, -5, 2000])).toBe(2);
  });

  it("devuelve null si el sensor está lleno", () => {
    const lleno = Array.from({ length: HUELLA_ID_MAX }, (_v, i) => i + 1);
    expect(elegirHuellaIdLibre(lleno)).toBeNull();
  });

  it("elige el último ID disponible cuando sólo queda uno", () => {
    const casiLleno = Array.from({ length: HUELLA_ID_MAX - 1 }, (_v, i) => i + 1);
    expect(elegirHuellaIdLibre(casiLleno)).toBe(HUELLA_ID_MAX);
  });
});
