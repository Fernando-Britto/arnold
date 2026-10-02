import {
  computeEstadoEquipos,
  computeSociosInactivos,
  computeCajaHoy,
  filterActivityFeed,
  computeAforo,
  computeAlertasVencimiento,
  computePersonalEnTurno,
  aggregateHomeInternoPart1,
  type ActivityEvent,
  type HomeInternoPart1Raw,
} from "./home-interno";

describe("computeEstadoEquipos (RN-05, AC-005: excludes Fuera de Servicio / Inactiva from the numerator)", () => {
  it("matches the spec's data scenario: 20 total, 2 Fuera de Servicio -> 90% (18/20)", () => {
    const maquinas = [
      ...Array(2).fill({ estado: "FUERA_DE_SERVICIO" as const }),
      ...Array(18).fill({ estado: "DISPONIBLE" as const }),
    ];
    const result = computeEstadoEquipos(maquinas);
    expect(result.porcentaje).toBe(90);
    expect(result.enMantenimiento).toBe(2);
  });

  it("also excludes Inactiva machines from the numerator, but not from enMantenimiento", () => {
    const maquinas = [
      { estado: "INACTIVA" as const },
      { estado: "FUERA_DE_SERVICIO" as const },
      { estado: "DISPONIBLE" as const },
      { estado: "OCUPADA" as const },
    ];
    const result = computeEstadoEquipos(maquinas);
    // numerator: DISPONIBLE + OCUPADA = 2, denominator: 4 -> 50%
    expect(result.porcentaje).toBe(50);
    // enMantenimiento only counts Fuera de Servicio, per the footer's own wording
    expect(result.enMantenimiento).toBe(1);
  });

  it("returns 0% without dividing by zero when there are no machines", () => {
    expect(computeEstadoEquipos([])).toEqual({ porcentaje: 0, enMantenimiento: 0 });
  });
});

describe("computeSociosInactivos (uses ConfiguracionDelSistema.diasInactividad)", () => {
  const hoy = new Date("2026-09-30T12:00:00Z");

  it("matches the spec's data scenario: diasInactividad=15, 42 socios past the threshold", () => {
    const ultimas = Array(42).fill(new Date("2026-09-01T00:00:00Z")); // 29 days ago
    const result = computeSociosInactivos(ultimas, 15, hoy);
    expect(result.cantidad).toBe(42);
    expect(result.footer).toBe("Sin visita > 15 días");
  });

  it("does not count a socio whose last visit is within the threshold", () => {
    const ultimas = [new Date("2026-09-20T00:00:00Z")]; // 10 days ago
    expect(computeSociosInactivos(ultimas, 15, hoy).cantidad).toBe(0);
  });

  it("counts a socio who never attended (null) as inactive", () => {
    expect(computeSociosInactivos([null], 15, hoy).cantidad).toBe(1);
  });
});

describe("computeCajaHoy (AC-004: sum of confirmed Pago.monto for today, grouped by metodoPago)", () => {
  const hoy = new Date("2026-09-30T18:00:00Z");

  it("matches the spec's data scenario: 3 Efectivo $50 + 2 Transferencia $100 -> 150/200/350", () => {
    const pagos = [
      { monto: 50, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-09-30T09:00:00Z") },
      { monto: 50, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-09-30T10:00:00Z") },
      { monto: 50, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-09-30T11:00:00Z") },
      { monto: 100, metodoPago: "TRANSFERENCIA" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-09-30T12:00:00Z") },
      { monto: 100, metodoPago: "TRANSFERENCIA" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-09-30T13:00:00Z") },
    ];
    const result = computeCajaHoy(pagos, hoy);
    expect(result.efectivo).toBe(150);
    expect(result.transferencia).toBe(200);
    expect(result.total).toBe(350);
  });

  it("ignores payments not CONFIRMADO", () => {
    const pagos = [
      { monto: 100, metodoPago: "EFECTIVO" as const, estado: "PENDIENTE" as const, fecha: hoy },
      { monto: 100, metodoPago: "EFECTIVO" as const, estado: "ANULADO" as const, fecha: hoy },
    ];
    expect(computeCajaHoy(pagos, hoy).total).toBe(0);
  });

  it("includes TARJETA payments in their own bucket and in the total (schema has 3 MetodoPago)", () => {
    const pagos = [
      { monto: 50, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO" as const, fecha: hoy },
      { monto: 30, metodoPago: "TARJETA" as const, estado: "CONFIRMADO" as const, fecha: hoy },
    ];
    expect(computeCajaHoy(pagos, hoy)).toEqual({ efectivo: 50, transferencia: 0, tarjeta: 30, total: 80 });
  });

  it("counts 'today' in the gym's timezone (ART, UTC-3), not UTC", () => {
    // 21:30 ART on 30/09 is already 01/10 in UTC: must still count as today.
    const tardeEnArgentina = { monto: 100, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-10-01T00:30:00Z") };
    // 23:30 ART on 29/09 is already 30/09 in UTC: must NOT count as today.
    const ayerEnArgentina = { monto: 70, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-09-30T02:30:00Z") };
    expect(computeCajaHoy([tardeEnArgentina, ayerEnArgentina], hoy).total).toBe(100);
  });

  it("ignores payments from a different day", () => {
    const pagos = [
      { monto: 100, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO" as const, fecha: new Date("2026-09-29T09:00:00Z") },
    ];
    expect(computeCajaHoy(pagos, hoy).total).toBe(0);
  });
});

describe("filterActivityFeed (spec: only 5 event types; check-ins/ingreso explicitly excluded; last 24h)", () => {
  const hoy = new Date("2026-09-30T18:00:00Z");

  const eventos: ActivityEvent[] = [
    { tipo: "PAGO", nombre: "Ana López", descripcion: "Pago de membresía Pro", fecha: new Date("2026-09-30T17:45:00Z") },
    { tipo: "INGRESO", nombre: "Carlos Ruiz", descripcion: "Ingreso al gimnasio", fecha: new Date("2026-09-30T17:58:00Z") },
    { tipo: "ALTA_SOCIO", nombre: "Carlos Mendez", descripcion: "Alta de nuevo socio", fecha: new Date("2026-09-30T04:00:00Z") },
    { tipo: "ASIGNACION_RUTINA", nombre: "Marcos Sosa", descripcion: "Nueva rutina asignada", fecha: new Date("2026-09-29T10:00:00Z") }, // >24h old
  ];

  it("excludes INGRESO events even though the design mock shows one (spec overrides the mock's filler data)", () => {
    const result = filterActivityFeed(eventos, hoy);
    expect(result.some((e) => e.tipo === "INGRESO")).toBe(false);
  });

  it("excludes events older than 24h", () => {
    const result = filterActivityFeed(eventos, hoy);
    expect(result.some((e) => e.descripcion === "Nueva rutina asignada")).toBe(false);
  });

  it("keeps qualifying event types within the last 24h, newest first", () => {
    const result = filterActivityFeed(eventos, hoy);
    expect(result.map((e) => e.nombre)).toEqual(["Ana López", "Carlos Mendez"]);
  });

  it("returns an empty array (not a crash) when nothing qualifies", () => {
    expect(filterActivityFeed([], hoy)).toEqual([]);
  });
});

describe("computeAforo (AC-003: percentage = active / capacidadMaxima * 100, rounded)", () => {
  it("matches the spec's data scenario: capacidad 100, 87 active -> 87%", () => {
    expect(computeAforo(87, 100)).toEqual({ ocupacionActual: 87, capacidadMaxima: 100, porcentaje: 87 });
  });

  it("rounds to the nearest integer", () => {
    expect(computeAforo(1, 3).porcentaje).toBe(33);
  });

  it("caps the percentage at 100 but keeps the true count (spec edge case: manual overrides)", () => {
    expect(computeAforo(120, 100)).toEqual({ ocupacionActual: 120, capacidadMaxima: 100, porcentaje: 100 });
  });

  it("does not divide by zero when capacidadMaxima is 0 or null", () => {
    expect(computeAforo(10, 0).porcentaje).toBe(0);
    expect(computeAforo(10, null)).toEqual({ ocupacionActual: 10, capacidadMaxima: 0, porcentaje: 0 });
  });
});

describe("computeAlertasVencimiento (AC-002, RN-02: only within 24h or inside the grace period)", () => {
  const hoy = new Date("2026-09-30T12:00:00Z");
  const cuota = (socioId: string, fechaVencimiento: string) => ({
    socioId,
    socioNombre: `Socio ${socioId}`,
    fechaVencimiento: new Date(fechaVencimiento),
  });

  it("includes a cuota expiring within the next 24h", () => {
    const result = computeAlertasVencimiento([cuota("a", "2026-10-01T06:00:00Z")], 0, hoy);
    expect(result).toHaveLength(1);
    expect(result[0].socioId).toBe("a");
    expect(result[0].texto).toBe("Vencimiento · Socio a");
  });

  it("includes a cuota already past due but inside the grace period", () => {
    const result = computeAlertasVencimiento([cuota("a", "2026-09-28T12:00:00Z")], 3, hoy);
    expect(result).toHaveLength(1);
    expect(result[0].detalle).toBe("Venció hace 2 días");
  });

  it("excludes a cuota past due beyond the grace period", () => {
    expect(computeAlertasVencimiento([cuota("a", "2026-09-20T12:00:00Z")], 3, hoy)).toHaveLength(0);
  });

  it("excludes a cuota expiring in more than 24h", () => {
    expect(computeAlertasVencimiento([cuota("a", "2026-10-02T12:00:00Z")], 3, hoy)).toHaveLength(0);
  });

  it("falls back to periodoGracia = 0 when the config value is null (spec edge case)", () => {
    const result = computeAlertasVencimiento([cuota("a", "2026-09-30T08:00:00Z")], null, hoy);
    expect(result).toHaveLength(0);
  });

  it("orders the most overdue first", () => {
    const result = computeAlertasVencimiento(
      [cuota("later", "2026-10-01T06:00:00Z"), cuota("overdue", "2026-09-29T12:00:00Z")],
      3,
      hoy
    );
    expect(result.map((r) => r.socioId)).toEqual(["overdue", "later"]);
  });
});

describe("computePersonalEnTurno (spec edge case: no staff -> 0 / 'Sin personal registrado')", () => {
  it("splits entrenadores (INSTRUCTOR) from the rest of the staff", () => {
    const personal = [
      ...Array(2).fill({ rol: "INSTRUCTOR" as const }),
      ...Array(3).fill({ rol: "RECEPCIONISTA" as const }),
      { rol: "ADMINISTRADOR" as const },
    ];
    expect(computePersonalEnTurno(personal)).toEqual({ cantidad: 6, footer: "2 entrenadores, 4 staff" });
  });

  it("uses the singular for a single entrenador", () => {
    expect(computePersonalEnTurno([{ rol: "INSTRUCTOR" }, { rol: "RECEPCIONISTA" }]).footer).toBe(
      "1 entrenador, 1 staff"
    );
  });

  it("returns 0 with an explicit footer when nobody is on shift", () => {
    expect(computePersonalEnTurno([])).toEqual({ cantidad: 0, footer: "Sin personal registrado" });
  });
});

describe("aggregateHomeInternoPart1 (composes Row_Hoy + Row_Operacion from raw data)", () => {
  const hoy = new Date("2026-09-30T18:00:00Z");
  const raw: HomeInternoPart1Raw = {
    config: { capacidadMaxima: 100, periodoGracia: 3, diasInactividad: 15 },
    maquinas: [
      ...Array(2).fill({ estado: "FUERA_DE_SERVICIO" as const }),
      ...Array(18).fill({ estado: "DISPONIBLE" as const }),
    ],
    pagos: [
      ...Array(3).fill({ monto: 50, metodoPago: "EFECTIVO" as const, estado: "CONFIRMADO", fecha: new Date("2026-09-30T10:00:00Z") }),
      ...Array(2).fill({ monto: 100, metodoPago: "TRANSFERENCIA" as const, estado: "CONFIRMADO", fecha: new Date("2026-09-30T11:00:00Z") }),
    ],
    cuotas: [{ socioId: "s1", socioNombre: "Marta G.", fechaVencimiento: new Date("2026-10-01T00:00:00Z") }],
    ultimasAsistencias: Array(42).fill(new Date("2026-09-01T00:00:00Z")),
    aforo: { asistenciasActivas: 87, horas: [{ hora: 18, ocupacion: 87 }], horaActual: 18 },
    personal: [{ rol: "INSTRUCTOR" }, { rol: "RECEPCIONISTA" }],
  };

  it("matches the spec's data scenarios end to end", () => {
    const vm = aggregateHomeInternoPart1(raw, hoy);
    expect(vm.aforo).toMatchObject({ ocupacionActual: 87, capacidadMaxima: 100, porcentaje: 87 });
    expect(vm.caja).toEqual({ efectivo: 150, transferencia: 200, tarjeta: 0, total: 350 });
    expect(vm.equipos).toEqual({ metric: "90%", footer: "2 en mantenimiento" });
    expect(vm.inactivos).toEqual({ metric: "42", footer: "Sin visita > 15 días" });
    expect(vm.personal).toEqual({ metric: "2", footer: "1 entrenador, 1 staff" });
    expect(vm.alertas).toHaveLength(1);
  });

  it("falls back to defaults when ConfiguracionDelSistema values are null, without crashing", () => {
    const vm = aggregateHomeInternoPart1(
      { ...raw, config: { capacidadMaxima: null, periodoGracia: null, diasInactividad: null } },
      hoy
    );
    expect(vm.aforo.porcentaje).toBe(0);
    expect(vm.inactivos.footer).toBe("Sin visita > 15 días");
  });
});
