/**
 * Cronómetro de descanso (D-44/D-48, T-038): función pura que calcula el tiempo restante
 * a partir de la hora de inicio guardada. Sobrevive a recargas porque no depende de un
 * contador en memoria, y es tolerante a que el reloj vaya para atrás.
 */
import { calcularDescanso, formatearDescanso } from "./descanso";

const inicio = new Date("2026-10-12T13:00:00.000Z");
const en = (segundos: number) => new Date(inicio.getTime() + segundos * 1000);

describe("calcularDescanso", () => {
  it("devuelve el descanso completo justo al iniciar", () => {
    expect(calcularDescanso(inicio, 120, inicio)).toEqual({
      restanteSegundos: 120,
      expirado: false,
    });
  });

  it("descuenta los segundos transcurridos", () => {
    expect(calcularDescanso(inicio, 120, en(45))).toEqual({
      restanteSegundos: 75,
      expirado: false,
    });
  });

  it("expira al llegar a cero exacto", () => {
    expect(calcularDescanso(inicio, 120, en(120))).toEqual({
      restanteSegundos: 0,
      expirado: true,
    });
  });

  it("queda en cero (expirado) pasado el descanso, sin negativos", () => {
    expect(calcularDescanso(inicio, 120, en(300))).toEqual({
      restanteSegundos: 0,
      expirado: true,
    });
  });

  it("es robusto si el reloj va para atrás: no da más descanso que el total", () => {
    const atras = new Date(inicio.getTime() - 60_000);
    expect(calcularDescanso(inicio, 120, atras)).toEqual({
      restanteSegundos: 120,
      expirado: false,
    });
  });

  it("un descanso de 0 segundos nace expirado", () => {
    expect(calcularDescanso(inicio, 0, inicio)).toEqual({
      restanteSegundos: 0,
      expirado: true,
    });
  });
});

describe("formatearDescanso", () => {
  it("formatea como M:SS con dos dígitos en los segundos", () => {
    expect(formatearDescanso(75)).toBe("1:15");
    expect(formatearDescanso(9)).toBe("0:09");
    expect(formatearDescanso(120)).toBe("2:00");
  });
});
