import {
  MAX_WAIT_POR_DEFECTO,
  TIMEOUT_CALCULO_POR_DEFECTO,
  timeoutsDeEntorno,
} from "./asignacion-timeouts";

describe("timeoutsDeEntorno", () => {
  it("sin variables usa los valores por defecto", () => {
    expect(timeoutsDeEntorno({})).toEqual({
      calculoMs: TIMEOUT_CALCULO_POR_DEFECTO,
      maxWaitMs: MAX_WAIT_POR_DEFECTO,
    });
  });

  it("acepta enteros dentro del rango", () => {
    expect(
      timeoutsDeEntorno({
        ASIGNACION_TIMEOUT_CALCULO_MS: "20000",
        ASIGNACION_MAX_WAIT_TRANSACCION_MS: "500",
      })
    ).toEqual({ calculoMs: 20000, maxWaitMs: 500 });
  });

  it("ignora valores no enteros o basura", () => {
    expect(
      timeoutsDeEntorno({
        ASIGNACION_TIMEOUT_CALCULO_MS: "12.5",
        ASIGNACION_MAX_WAIT_TRANSACCION_MS: "abc",
      })
    ).toEqual({ calculoMs: 2000, maxWaitMs: 1000 });
  });

  it("ignora valores fuera de rango", () => {
    expect(
      timeoutsDeEntorno({
        ASIGNACION_TIMEOUT_CALCULO_MS: "100",
        ASIGNACION_MAX_WAIT_TRANSACCION_MS: "60000",
      })
    ).toEqual({ calculoMs: 2000, maxWaitMs: 1000 });
  });

  it("no lanza con cualquier entrada", () => {
    expect(() => timeoutsDeEntorno({ ASIGNACION_TIMEOUT_CALCULO_MS: "" })).not.toThrow();
  });
});
