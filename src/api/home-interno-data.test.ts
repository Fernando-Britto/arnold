import { buildHomeInternoPayload, buildAforoHoras } from "./home-interno-data";
import { fetchHomeInternoData } from "./home-interno";
import { aggregateHomeInterno } from "@/domains/home-interno/home-interno";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    configuracionDelSistema: { findFirst: jest.fn() },
    maquina: { findMany: jest.fn() },
    pago: { findMany: jest.fn() },
    socio: { findMany: jest.fn(), count: jest.fn() },
    asistencia: { findMany: jest.fn() },
    empleado: { findMany: jest.fn() },
    usuario: { findMany: jest.fn() },
    rutinaAsignada: { findMany: jest.fn() },
    rutina: { count: jest.fn() },
    ejercicio: { count: jest.fn() },
    membresia: { count: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// 18:00Z = 15:00 en Argentina (UTC-3), miércoles 30/09/2026 → turno TARDE
const NOW = new Date("2026-09-30T18:00:00Z");
const dec = (n: number) => ({ toString: () => n.toFixed(2) }); // imita Prisma.Decimal: Number(x) funciona
const at = (iso: string) => new Date(iso);

function seed() {
  db.configuracionDelSistema.findFirst.mockResolvedValue({
    capacidadMaxima: 100,
    periodoGracia: 3,
    diasInactividad: 15,
    ventanaAforoMinutos: 90,
  });
  db.maquina.findMany.mockResolvedValue([
    ...Array(2).fill({ estado: "FUERA_DE_SERVICIO" }),
    ...Array(18).fill({ estado: "DISPONIBLE" }),
  ]);
  db.pago.findMany.mockImplementation(async (args: { where: { estado: unknown } }) => {
    if (typeof args.where.estado === "string") {
      return [
        ...Array(3).fill({ monto: dec(50), metodoPago: "EFECTIVO", estado: "CONFIRMADO", fechaPago: at("2026-09-30T10:00:00Z") }),
        ...Array(2).fill({ monto: dec(100), metodoPago: "TRANSFERENCIA", estado: "CONFIRMADO", fechaPago: at("2026-09-30T11:00:00Z") }),
      ];
    }
    return [
      { estado: "CONFIRMADO", fechaPago: at("2026-09-30T17:45:00Z"), socio: { usuario: { nombre: "Ana López" }, membresiaAsignada: { nombre: "Pro" } } },
      { estado: "ANULADO", fechaPago: at("2026-09-30T16:30:00Z"), socio: { usuario: { nombre: "Luis Gómez" }, membresiaAsignada: null } },
      { estado: "CONFIRMADO", fechaPago: at("2026-09-30T12:00:00Z"), socio: null },
    ];
  });
  db.socio.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    if ("fechaAlta" in args.where) {
      return [{ fechaAlta: at("2026-09-30T16:00:00Z"), usuario: { nombre: "Carlos Mendez" } }];
    }
    return [
      { id: "s1", usuario: { nombre: "Marta G." }, cuotas: [{ fechaVencimiento: at("2026-10-01T00:00:00Z") }], asistencias: [{ fechaHora: at("2026-09-30T14:00:00Z") }] },
      { id: "s2", usuario: { nombre: "Juan P." }, cuotas: [], asistencias: [] },
    ];
  });
  db.asistencia.findMany.mockResolvedValue([
    { fechaHora: at("2026-09-30T10:00:00Z") }, // 07h ART → franja 6
    { fechaHora: at("2026-09-30T12:00:00Z") }, // 09h ART → franja 8
    ...Array(5).fill({ fechaHora: at("2026-09-30T17:00:00Z") }), // 14h ART → franja 14, dentro de la ventana de 90 min
  ]);
  db.empleado.findMany.mockResolvedValue([{ usuario: { rol: "INSTRUCTOR" } }, { usuario: { rol: "RECEPCIONISTA" } }]);
  db.usuario.findMany.mockResolvedValue([{ nombre: "Elena P.", deletedAt: at("2026-09-30T15:00:00Z") }]);
  db.rutinaAsignada.findMany.mockResolvedValue([
    { fechaAsignacion: at("2026-09-30T14:00:00Z"), rutina: { nombre: "Fuerza A" }, socio: { usuario: { nombre: "Marcos Sosa" } } },
  ]);
  db.rutina.count.mockResolvedValue(124);
  db.ejercicio.count.mockResolvedValue(342);
  db.socio.count.mockResolvedValue(892);
  db.membresia.count.mockResolvedValue(15);
}

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

describe("buildHomeInternoPayload — mapeo de la base al contrato", () => {
  it("devuelve la hora del servidor y la configuración", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.ahora).toBe("2026-09-30T18:00:00.000Z");
    expect(p.config).toEqual({ capacidadMaxima: 100, periodoGracia: 3, diasInactividad: 15 });
  });

  it("sin fila de configuración, entrega nulls (el dominio aplica los defaults)", async () => {
    db.configuracionDelSistema.findFirst.mockResolvedValue(null);
    const p = await buildHomeInternoPayload(NOW);
    expect(p.config).toEqual({ capacidadMaxima: null, periodoGracia: null, diasInactividad: null });
  });

  it("máquinas: solo el estado", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.maquinas).toHaveLength(20);
    expect(p.maquinas[0]).toEqual({ estado: "FUERA_DE_SERVICIO" });
  });

  it("pagos: Decimal → número, fecha ISO, y la consulta cubre todo el día argentino (36h)", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.pagos[0]).toEqual({ monto: 50, metodoPago: "EFECTIVO", estado: "CONFIRMADO", fecha: "2026-09-30T10:00:00.000Z" });
    const consultaDelDia = db.pago.findMany.mock.calls.map((c: unknown[]) => c[0]).find(
      (a: { where: { estado: unknown } }) => typeof a.where.estado === "string"
    );
    expect(consultaDelDia.where.estado).toBe("CONFIRMADO");
    expect(consultaDelDia.where.fechaPago.gte).toEqual(new Date("2026-09-29T06:00:00Z"));
  });

  it("padrón: una cuota (la última) y la última asistencia PERMITIDA por socio; null si nunca vino", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.cuotas).toEqual([{ socioId: "s1", socioNombre: "Marta G.", fechaVencimiento: "2026-10-01T00:00:00.000Z" }]);
    expect(p.ultimasAsistencias).toEqual(["2026-09-30T14:00:00.000Z", null]);
    const roster = db.socio.findMany.mock.calls.map((c: unknown[]) => c[0]).find(
      (a: { where: Record<string, unknown> }) => !("fechaAlta" in a.where)
    );
    expect(roster.where).toEqual({ usuario: { estado: "ACTIVO", deletedAt: null } });
    expect(roster.select.asistencias.where).toEqual({ estado: "PERMITIDO" });
  });

  it("aforo: cuenta las entradas dentro de la ventana configurada y arma las franjas del día", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.aforo.asistenciasActivas).toBe(5);
    expect(p.aforo.horaActual).toBe(14);
    expect(p.aforo.horas).toEqual([
      { hora: 6, ocupacion: 1 },
      { hora: 8, ocupacion: 1 },
      { hora: 10, ocupacion: 0 },
      { hora: 12, ocupacion: 0 },
      { hora: 14, ocupacion: 5 },
      { hora: 16, ocupacion: 0 },
      { hora: 18, ocupacion: 0 },
      { hora: 20, ocupacion: 0 },
      { hora: 22, ocupacion: 0 },
    ]);
  });

  it("la ventana de aforo sale de la configuración, no de un número fijo", async () => {
    db.configuracionDelSistema.findFirst.mockResolvedValue({ capacidadMaxima: 100, periodoGracia: 0, diasInactividad: 15, ventanaAforoMinutos: 30 });
    const p = await buildHomeInternoPayload(NOW);
    expect(p.aforo.asistenciasActivas).toBe(0); // las de 17:00Z quedan fuera de 30 min
  });

  it("personal: filtra por el turno vigente (15h ART → TARDE) y solo empleados activos", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.personal).toEqual([{ rol: "INSTRUCTOR" }, { rol: "RECEPCIONISTA" }]);
    expect(db.empleado.findMany.mock.calls[0][0].where).toEqual({
      estadoLaboral: "ACTIVO",
      turno: "TARDE",
      usuario: { estado: "ACTIVO", deletedAt: null },
    });
  });

  it("contadores: las cuatro tablas", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.contadores).toEqual({ rutinas: 124, ejercicios: 342, clientes: 892, membresias: 15 });
  });

  it("eventos: cinco tipos del feed, más nuevo primero, con el texto de la spec", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.eventos.map((e) => [e.tipo, e.nombre, e.descripcion])).toEqual([
      ["PAGO", "Ana López", "Pago de membresía Pro"],
      ["ANULACION_PAGO", "Luis Gómez", "Pago anulado"],
      ["ALTA_SOCIO", "Carlos Mendez", "Alta de nuevo socio"],
      ["BAJA_SOCIO", "Elena P.", "Baja de socio"],
      ["ASIGNACION_RUTINA", "Marcos Sosa", "Rutina asignada: Fuerza A"],
      ["PAGO", "Pago sin socio", "Pago registrado"],
    ]); // por fecha descendente: 17:45, 16:30, 16:00, 15:00, 14:00, 12:00
  });

  it("eventos: nunca incluye ingresos (la spec los excluye del feed)", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.eventos.some((e) => e.tipo === "INGRESO")).toBe(false);
  });

  it("base vacía: payload válido, sin romper", async () => {
    db.configuracionDelSistema.findFirst.mockResolvedValue(null);
    for (const m of [db.maquina, db.pago, db.socio, db.asistencia, db.empleado, db.usuario, db.rutinaAsignada]) m.findMany.mockResolvedValue([]);
    for (const m of [db.rutina, db.ejercicio, db.socio, db.membresia]) m.count.mockResolvedValue(0);
    const p = await buildHomeInternoPayload(NOW);
    expect(p.eventos).toEqual([]);
    expect(p.personal).toEqual([]);
    expect(p.aforo.asistenciasActivas).toBe(0);
    expect(p.aforo.horas).toHaveLength(9);
  });
});

describe("contrato servidor ↔ cliente ↔ dominio (el mismo camino que recorre la página)", () => {
  it("el payload, ya serializado como JSON, produce los números de la spec", async () => {
    const payload = JSON.parse(JSON.stringify(await buildHomeInternoPayload(NOW)));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payload });

    const data = await fetchHomeInternoData();
    const vm = aggregateHomeInterno(data, data.ahora);

    expect(vm.caja).toEqual({ efectivo: 150, transferencia: 200, tarjeta: 0, total: 350 });
    expect(vm.aforo).toMatchObject({ ocupacionActual: 5, capacidadMaxima: 100, porcentaje: 5 });
    expect(vm.equipos).toEqual({ metric: "90%", footer: "2 en mantenimiento" });
    expect(vm.personal).toEqual({ metric: "2", footer: "1 entrenador, 1 staff" });
    expect(vm.inactivos).toEqual({ metric: "1", footer: "Sin visita > 15 días" }); // Juan P.: nunca vino
    expect(vm.alertas.map((a) => a.texto)).toEqual(["Vencimiento · Marta G."]);
    expect(vm.gestion).toEqual({ rutinas: "124", ejercicios: "342", clientes: "892", membresias: "15" });
    expect(vm.actividad.map((a) => a.nombre)).toEqual(["Ana López", "Luis Gómez", "Carlos Mendez", "Elena P.", "Marcos Sosa", "Pago sin socio"]);
  });
});

describe("buildAforoHoras", () => {
  it("las entradas fuera de 06–22 no caen en ninguna franja", () => {
    const { horas } = buildAforoHoras([new Date("2026-09-30T05:00:00Z")], NOW); // 02:00 ART
    expect(horas.every((h) => h.ocupacion === 0)).toBe(true);
  });
});
