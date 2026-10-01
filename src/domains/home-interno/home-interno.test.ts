import {
  computeEstadoEquipos,
  computeSociosInactivos,
  computeCajaHoy,
  filterActivityFeed,
  type ActivityEvent,
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
