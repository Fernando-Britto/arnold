import {
  computeAforoPercentage,
  computeMembresiaStatus,
  computeDiasAsistidosSemana,
  compute28DiasAsistencia,
  buildSemanaCalendario,
  computeRachaSemanas,
  selectRutinaActiva,
} from "./home-socio";

describe("computeAforoPercentage (spec: home-socio-portal §AforoCard, AC-005)", () => {
  it("computes the percentage of capacity currently occupied", () => {
    expect(computeAforoPercentage(45, 100)).toBe(45);
  });

  it("rounds to the nearest whole percent", () => {
    expect(computeAforoPercentage(1, 3)).toBe(33);
  });

  it("returns 0 without dividing by zero when capacidadMaxima is 0 (misconfiguration)", () => {
    expect(computeAforoPercentage(5, 0)).toBe(0);
  });

  it("caps at 100 even if occupancy data is momentarily over capacity", () => {
    expect(computeAforoPercentage(120, 100)).toBe(100);
  });
});

describe("computeMembresiaStatus (spec: home-socio-portal §MembresiCard, AC-007, Edge Cases)", () => {
  const hoy = new Date("2026-09-26T12:00:00Z");

  it('is "AL_DIA" with no renewal prompt when more than 7 days remain', () => {
    const vencimiento = new Date("2026-10-11T00:00:00Z"); // 15 days out
    const result = computeMembresiaStatus(vencimiento, hoy);
    expect(result.estado).toBe("AL_DIA");
    expect(result.mostrarRenovar).toBe(false);
    expect(result.diasRestantes).toBe(15);
  });

  it('is "POR_VENCER" with the renewal prompt when exactly 7 days remain (AC-007 boundary)', () => {
    const vencimiento = new Date("2026-10-03T12:00:00Z"); // 7 days out
    const result = computeMembresiaStatus(vencimiento, hoy);
    expect(result.estado).toBe("POR_VENCER");
    expect(result.mostrarRenovar).toBe(true);
    expect(result.diasRestantes).toBe(7);
  });

  it('is "VENCIDA" with the renewal prompt shown regardless of the 7-day threshold (edge case)', () => {
    const vencimiento = new Date("2026-09-20T12:00:00Z"); // 6 days in the past
    const result = computeMembresiaStatus(vencimiento, hoy);
    expect(result.estado).toBe("VENCIDA");
    expect(result.mostrarRenovar).toBe(true);
    expect(result.diasRestantes).toBe(-6);
  });
});

describe("computeDiasAsistidosSemana (spec: home-socio-portal §RachaSemanal, AC-006)", () => {
  it("maps attendance to the calendar Mon–Sun week, not a rolling 7-day window", () => {
    // Thursday 2026-09-24 is the reference "today" — the calendar week is
    // Mon 2026-09-21 .. Sun 2026-09-27.
    const hoy = new Date("2026-09-24T10:00:00Z");
    const asistencias = [
      new Date("2026-09-21T09:00:00Z"), // Mon
      new Date("2026-09-23T09:00:00Z"), // Wed
      new Date("2026-09-25T09:00:00Z"), // Fri
      new Date("2026-09-14T09:00:00Z"), // outside this week — must be ignored
    ];
    const dias = computeDiasAsistidosSemana(asistencias, hoy);
    expect(dias).toEqual([true, false, true, false, true, false, false]);
  });

  it("returns all-false for a week with no attendance", () => {
    const hoy = new Date("2026-09-24T10:00:00Z");
    expect(computeDiasAsistidosSemana([], hoy)).toEqual([
      false, false, false, false, false, false, false,
    ]);
  });
});

describe("compute28DiasAsistencia (StravaWidget grid: 4 calendar weeks Mon–Sun, last row = current week)", () => {
  // hoy = Thu 2026-09-24 -> current week Mon 09-21..Sun 09-27; grid starts Mon 08-31
  const hoy = new Date("2026-09-24T10:00:00Z");

  it("aligns columns to weekdays: index 0 is the Monday 3 weeks before the current week, index 27 is the current Sunday", () => {
    const asistencias = [
      new Date("2026-08-31T09:00:00Z"), // first cell (index 0)
      new Date("2026-09-21T09:00:00Z"), // Monday of current week (index 21)
      new Date("2026-09-24T09:00:00Z"), // today, Thursday (index 24)
    ];
    const { dias, total } = compute28DiasAsistencia(asistencias, hoy);
    expect(dias).toHaveLength(28);
    expect(dias[0]).toBe(true);
    expect(dias[21]).toBe(true);
    expect(dias[24]).toBe(true);
    expect(dias.filter(Boolean)).toHaveLength(3);
    expect(total).toBe(3);
  });

  it("ignores attendance before the 4-week window", () => {
    const { total } = compute28DiasAsistencia([new Date("2026-08-15T09:00:00Z")], hoy);
    expect(total).toBe(0);
  });

  it("counts multiple visits on the same day only once", () => {
    const { total } = compute28DiasAsistencia(
      [new Date("2026-09-24T08:00:00Z"), new Date("2026-09-24T18:00:00Z")],
      hoy
    );
    expect(total).toBe(1);
  });

  it("returns 28 empty days and total 0 with no attendance", () => {
    const { dias, total } = compute28DiasAsistencia([], hoy);
    expect(dias).toHaveLength(28);
    expect(dias.every((d) => d === false)).toBe(true);
    expect(total).toBe(0);
  });
});

describe("buildSemanaCalendario (RachaSemanal weekly calendar: day numbers, attended, today)", () => {
  it("returns 7 Mon–Sun entries with day-of-month numbers, attendance and today flag", () => {
    const hoy = new Date("2026-09-24T10:00:00Z"); // Thursday; week Mon 21 .. Sun 27
    const asistencias = [new Date("2026-09-21T09:00:00Z"), new Date("2026-09-23T09:00:00Z")];
    const semana = buildSemanaCalendario(asistencias, hoy);
    expect(semana.map((d) => d.numero)).toEqual([21, 22, 23, 24, 25, 26, 27]);
    expect(semana.map((d) => d.asistio)).toEqual([true, false, true, false, false, false, false]);
    expect(semana.map((d) => d.esHoy)).toEqual([false, false, false, true, false, false, false]);
  });
});

describe("computeRachaSemanas (consecutive calendar weeks with at least one attendance)", () => {
  const hoy = new Date("2026-09-24T10:00:00Z"); // week of Mon 09-21

  it("counts consecutive weeks including the current one", () => {
    const asistencias = [
      new Date("2026-09-22T09:00:00Z"), // this week
      new Date("2026-09-15T09:00:00Z"), // last week
      new Date("2026-09-08T09:00:00Z"), // 2 weeks ago
    ];
    expect(computeRachaSemanas(asistencias, hoy)).toBe(3);
  });

  it("does not break the streak just because the current week has no attendance yet", () => {
    const asistencias = [new Date("2026-09-15T09:00:00Z"), new Date("2026-09-08T09:00:00Z")];
    expect(computeRachaSemanas(asistencias, hoy)).toBe(2);
  });

  it("stops at the first week with no attendance", () => {
    const asistencias = [
      new Date("2026-09-22T09:00:00Z"),
      new Date("2026-09-15T09:00:00Z"),
      // gap: week of 09-08 missing
      new Date("2026-09-01T09:00:00Z"),
    ];
    expect(computeRachaSemanas(asistencias, hoy)).toBe(2);
  });

  it("returns 0 with no attendance", () => {
    expect(computeRachaSemanas([], hoy)).toBe(0);
  });
});
