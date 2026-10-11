/**
 * Cálculo de cuotas mensuales (T-031, D-40).
 * Spec: openspec/specs/pagos-cuotas/spec.md
 *
 * Todas las fechas se interpretan en hora argentina (UTC-3, sin horario de verano).
 */
import {
  periodoDe,
  sumarPeriodos,
  diasDelPeriodo,
  inicioDePeriodo,
  finDePeriodo,
  fechaLimitePago,
  calcularAlta,
  planDePago,
  estadoCuotaSocio,
} from "./cuota";

const d = (iso: string) => new Date(`${iso}-03:00`);

describe("períodos (mes calendario, hora argentina)", () => {
  it("periodoDe usa la hora del gimnasio, no UTC", () => {
    // 31/10 23:30 en Argentina ya es 01/11 02:30 UTC: sigue siendo octubre
    expect(periodoDe(d("2026-10-31T23:30:00"))).toBe("2026-10");
    expect(periodoDe(d("2026-11-01T00:00:00"))).toBe("2026-11");
  });

  it("sumarPeriodos cruza el cambio de año en ambos sentidos", () => {
    expect(sumarPeriodos("2026-12", 1)).toBe("2027-01");
    expect(sumarPeriodos("2026-01", -1)).toBe("2025-12");
    expect(sumarPeriodos("2026-05", 0)).toBe("2026-05");
    expect(sumarPeriodos("2026-05", 14)).toBe("2027-07");
  });

  it("diasDelPeriodo respeta meses de 28, 29, 30 y 31 días", () => {
    expect(diasDelPeriodo("2026-02")).toBe(28);
    expect(diasDelPeriodo("2028-02")).toBe(29);
    expect(diasDelPeriodo("2026-04")).toBe(30);
    expect(diasDelPeriodo("2026-12")).toBe(31);
  });

  it("inicioDePeriodo y finDePeriodo son el primer y el último instante del mes", () => {
    expect(inicioDePeriodo("2026-11").toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(finDePeriodo("2026-11").toISOString()).toBe("2026-12-01T02:59:59.999Z");
    expect(finDePeriodo("2026-02").toISOString()).toBe("2026-03-01T02:59:59.999Z");
  });
});

describe("fechaLimitePago", () => {
  it("es el final del día límite (día 10) en hora argentina", () => {
    expect(fechaLimitePago("2026-11", 10).toISOString()).toBe("2026-11-11T02:59:59.999Z");
  });

  it("suma el período de gracia", () => {
    expect(fechaLimitePago("2026-11", 10, 3).toISOString()).toBe("2026-11-14T02:59:59.999Z");
  });

  it("no se pasa al mes siguiente si el límite no entra en el mes", () => {
    expect(fechaLimitePago("2026-02", 10, 30).toISOString()).toBe(finDePeriodo("2026-02").toISOString());
  });
});

describe("calcularAlta (opción 2: prorrateo hasta el día de corte, cuota completa después)", () => {
  const precio = 30000;

  it("alta el día 1: cuota completa del mes, sin descuento", () => {
    const r = calcularAlta({ fechaAlta: d("2026-11-01T10:00:00"), precio, diaCorte: 20 });
    expect(r.tipo).toBe("ALTA_PRORRATEO");
    expect(r.monto).toBe(30000);
    expect(r.cubreHasta.toISOString()).toBe(finDePeriodo("2026-11").toISOString());
  });

  it("alta antes del corte: prorratea los días que quedan, contando el día del alta", () => {
    // 16 de noviembre: quedan 15 de 30 días (16 al 30)
    const r = calcularAlta({ fechaAlta: d("2026-11-16T18:00:00"), precio, diaCorte: 20 });
    expect(r.tipo).toBe("ALTA_PRORRATEO");
    expect(r.monto).toBe(15000);
    expect(r.periodos).toEqual(["2026-11"]);
    expect(r.cubreDesde.toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(r.cubreHasta.toISOString()).toBe(finDePeriodo("2026-11").toISOString());
  });

  it("el día de corte todavía prorratea (el corte es inclusivo)", () => {
    const r = calcularAlta({ fechaAlta: d("2026-11-20T09:00:00"), precio, diaCorte: 20 });
    expect(r.tipo).toBe("ALTA_PRORRATEO");
    expect(r.monto).toBe(11000); // 11 de 30 días
  });

  it("alta después del corte: cuota completa que cubre lo que queda del mes y el mes siguiente", () => {
    const r = calcularAlta({ fechaAlta: d("2026-10-30T11:00:00"), precio, diaCorte: 20 });
    expect(r.tipo).toBe("ALTA_COMPLETA");
    expect(r.monto).toBe(30000);
    expect(r.periodos).toEqual(["2026-10", "2026-11"]);
    expect(r.cubreDesde.toISOString()).toBe("2026-10-30T03:00:00.000Z");
    expect(r.cubreHasta.toISOString()).toBe(finDePeriodo("2026-11").toISOString());
  });

  it("alta tardía en diciembre cruza el cambio de año", () => {
    const r = calcularAlta({ fechaAlta: d("2026-12-28T11:00:00"), precio, diaCorte: 20 });
    expect(r.periodos).toEqual(["2026-12", "2027-01"]);
    expect(r.cubreHasta.toISOString()).toBe(finDePeriodo("2027-01").toISOString());
  });

  it("redondea el prorrateo al centavo", () => {
    // 30 de diciembre con corte 31: quedan 2 de 31 días → 30000 * 2 / 31 = 1935,48…
    const r = calcularAlta({ fechaAlta: d("2026-12-30T10:00:00"), precio, diaCorte: 31 });
    expect(r.monto).toBe(1935.48);
  });

  it("rechaza precio inválido y día de corte fuera de 1–31", () => {
    const base = { fechaAlta: d("2026-11-05T10:00:00"), precio, diaCorte: 20 };
    expect(() => calcularAlta({ ...base, precio: -1 })).toThrow();
    expect(() => calcularAlta({ ...base, precio: NaN })).toThrow();
    expect(() => calcularAlta({ ...base, diaCorte: 0 })).toThrow();
    expect(() => calcularAlta({ ...base, diaCorte: 32 })).toThrow();
    expect(() => calcularAlta({ ...base, diaCorte: 10.5 })).toThrow();
  });
});

describe("planDePago", () => {
  const base = { precio: 30000, diaCorte: 20 };

  it("sin cuotas previas se trata como alta", () => {
    const r = planDePago({ ...base, ultimoPeriodoCubierto: null, hoy: d("2026-11-25T10:00:00") });
    expect(r.tipo).toBe("ALTA_COMPLETA");
    expect(r.periodos).toEqual(["2026-11", "2026-12"]);
  });

  it("renovación en término: paga el mes actual completo", () => {
    // cubierto hasta octubre; paga el 5 de noviembre
    const r = planDePago({ ...base, ultimoPeriodoCubierto: "2026-10", hoy: d("2026-11-05T10:00:00") });
    expect(r.tipo).toBe("RENOVACION");
    expect(r.periodos).toEqual(["2026-11"]);
    expect(r.monto).toBe(30000);
    expect(r.cubreDesde.toISOString()).toBe(inicioDePeriodo("2026-11").toISOString());
    expect(r.cubreHasta.toISOString()).toBe(finDePeriodo("2026-11").toISOString());
  });

  it("renovación tardía (pasó el día 10 pero no se cortó la continuidad): paga el mes completo igual", () => {
    const r = planDePago({ ...base, ultimoPeriodoCubierto: "2026-10", hoy: d("2026-11-27T10:00:00") });
    expect(r.tipo).toBe("RENOVACION");
    expect(r.periodos).toEqual(["2026-11"]);
    expect(r.monto).toBe(30000);
  });

  it("pago adelantado: paga el período siguiente al último cubierto", () => {
    const r = planDePago({ ...base, ultimoPeriodoCubierto: "2026-11", hoy: d("2026-11-25T10:00:00") });
    expect(r.tipo).toBe("RENOVACION");
    expect(r.periodos).toEqual(["2026-12"]);
  });

  it("pago adelantado varias veces seguidas sigue encadenando períodos", () => {
    const r = planDePago({ ...base, ultimoPeriodoCubierto: "2027-01", hoy: d("2026-11-25T10:00:00") });
    expect(r.periodos).toEqual(["2027-02"]);
  });

  it("reingreso tras una pausa (un mes entero sin cobertura): se trata como alta, sin deuda retroactiva", () => {
    const r = planDePago({ ...base, ultimoPeriodoCubierto: "2026-08", hoy: d("2026-11-10T10:00:00") });
    expect(r.tipo).toBe("ALTA_PRORRATEO");
    expect(r.periodos).toEqual(["2026-11"]);
    expect(r.monto).toBe(21000); // 21 de 30 días
  });
});

describe("estadoCuotaSocio", () => {
  const base = { diaLimite: 10, gracia: 0 };

  it("SIN_CUOTA si nunca pagó", () => {
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: null, hoy: d("2026-11-05T10:00:00") })).toBe("SIN_CUOTA");
  });

  it("AL_DIA si el mes actual está cubierto, hasta el último instante del mes", () => {
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: "2026-11", hoy: d("2026-11-30T23:59:00") })).toBe("AL_DIA");
  });

  it("AL_DIA si pagó por adelantado", () => {
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: "2027-01", hoy: d("2026-11-15T10:00:00") })).toBe("AL_DIA");
  });

  it("PENDIENTE del 1 al 10 del mes si no pagó el mes nuevo (el acceso sigue permitido, con aviso)", () => {
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: "2026-10", hoy: d("2026-11-01T00:00:00") })).toBe("PENDIENTE");
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: "2026-10", hoy: d("2026-11-10T23:59:59") })).toBe("PENDIENTE");
  });

  it("VENCIDA desde el día 11", () => {
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: "2026-10", hoy: d("2026-11-11T00:00:00") })).toBe("VENCIDA");
  });

  it("el período de gracia extiende el PENDIENTE", () => {
    const g = { diaLimite: 10, gracia: 3 };
    expect(estadoCuotaSocio({ ...g, ultimoPeriodoCubierto: "2026-10", hoy: d("2026-11-13T12:00:00") })).toBe("PENDIENTE");
    expect(estadoCuotaSocio({ ...g, ultimoPeriodoCubierto: "2026-10", hoy: d("2026-11-14T00:00:00") })).toBe("VENCIDA");
  });

  it("VENCIDA si pasó más de un mes sin cobertura, aunque sea día 5", () => {
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: "2026-09", hoy: d("2026-11-05T10:00:00") })).toBe("VENCIDA");
  });

  it("usa la hora argentina en el cambio de mes", () => {
    // 01/11 01:00 UTC = 31/10 22:00 en Argentina: todavía es octubre y está cubierto
    expect(estadoCuotaSocio({ ...base, ultimoPeriodoCubierto: "2026-10", hoy: new Date("2026-11-01T01:00:00Z") })).toBe("AL_DIA");
  });
});
