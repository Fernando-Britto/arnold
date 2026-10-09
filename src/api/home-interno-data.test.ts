import { buildHomeInternoPayload, buildAforoHoras } from "./home-interno-data";
import { fetchHomeInternoData } from "./home-interno";
import { aggregateHomeInterno } from "@/domains/home-interno/home-interno";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    configuracionDelSistema: { findFirst: jest.fn() },
    maquina: { findMany: jest.fn() },
    pago: { findMany: jest.fn() },
    socio: { findMany: jest.fn() },
    usuario: { findMany: jest.fn() },
    cuota: { groupBy: jest.fn() },
    asistencia: { findMany: jest.fn(), groupBy: jest.fn() },
    rutinaAsignada: { findMany: jest.fn() },
    rutina: { count: jest.fn(), findMany: jest.fn() },
    ejercicio: { count: jest.fn() },
    membresia: { findMany: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// 18:00Z = 15:00 en Argentina (UTC-3), miércoles 30/09/2026 → turno TARDE
const NOW = new Date("2026-09-30T18:00:00Z");
const dec = (n: number) => ({ toString: () => n.toFixed(2) }); // imita Prisma.Decimal: Number(x) funciona
const at = (iso: string) => new Date(iso);

const VIEJO = at("2026-01-01T00:00:00Z");
const socio = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  socio: { id, usuarioId: `u-${id}`, membresiaAsignadaId: null, fechaAlta: VIEJO, ...extra },
  usuario: { id: `u-${id}`, nombre, estado: "ACTIVO", deletedAt: null },
});
const PADRON = [
  socio("s1", "Marta G."),
  socio("s2", "Juan P."),
  socio("s-ana", "Ana López", { membresiaAsignadaId: "m-pro" }),
  socio("s-luis", "Luis Gómez"),
  socio("s-pablo", "Pablo R."),
  socio("s-carlos", "Carlos Mendez", { fechaAlta: at("2026-09-30T16:00:00Z") }), // alta hace 2 h
  socio("s-marcos", "Marcos Sosa"),
  { ...socio("s-elena", "Elena P."), usuario: { id: "u-s-elena", nombre: "Elena P.", estado: "ACTIVO", deletedAt: at("2026-09-30T15:00:00Z") } }, // baja hace 3 h
];

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
  // Una sola consulta de pagos de las últimas 36 h (CONFIRMADO y ANULADO); el feed de 24 h sale de la misma.
  db.pago.findMany.mockResolvedValue([
    { estado: "CONFIRMADO", monto: dec(50), metodoPago: "EFECTIVO", fechaPago: at("2026-09-30T17:45:00Z"), socioId: "s-ana" },
    { estado: "ANULADO", monto: dec(70), metodoPago: "EFECTIVO", fechaPago: at("2026-09-30T16:30:00Z"), socioId: "s-luis" },
    { estado: "CONFIRMADO", monto: dec(50), metodoPago: "EFECTIVO", fechaPago: at("2026-09-30T12:00:00Z"), socioId: null },
    { estado: "CONFIRMADO", monto: dec(100), metodoPago: "TRANSFERENCIA", fechaPago: at("2026-09-30T11:00:00Z"), socioId: null },
    { estado: "CONFIRMADO", monto: dec(50), metodoPago: "EFECTIVO", fechaPago: at("2026-09-30T10:00:00Z"), socioId: "s-pablo" },
    { estado: "CONFIRMADO", monto: dec(100), metodoPago: "TRANSFERENCIA", fechaPago: at("2026-09-30T09:00:00Z"), socioId: null },
    { estado: "CONFIRMADO", monto: dec(999), metodoPago: "TARJETA", fechaPago: at("2026-09-29T08:00:00Z"), socioId: null }, // 34 h atrás: no es del feed de 24 h
  ]);
  db.socio.findMany.mockResolvedValue(PADRON.map((p) => p.socio));
  db.usuario.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) =>
    "empleado" in args.where
      ? [{ rol: "INSTRUCTOR" }, { rol: "RECEPCIONISTA" }]
      : PADRON.map((p) => p.usuario)
  );
  // Última cuota y última asistencia por socio, agregadas en la base (una fila por socio).
  db.cuota.groupBy.mockResolvedValue([{ socioId: "s1", _max: { fechaVencimiento: at("2026-10-01T00:00:00Z") } }]);
  db.asistencia.groupBy.mockResolvedValue(
    PADRON.filter((p) => p.socio.id !== "s2").map((p) => ({ socioId: p.socio.id, _max: { fechaHora: at("2026-09-30T14:00:00Z") } }))
  );
  db.asistencia.findMany.mockResolvedValue([
    { fechaHora: at("2026-09-30T10:00:00Z") }, // 07h ART → franja 6
    { fechaHora: at("2026-09-30T12:00:00Z") }, // 09h ART → franja 8
    ...Array(5).fill({ fechaHora: at("2026-09-30T17:00:00Z") }), // 14h ART → franja 14, dentro de la ventana de 90 min
  ]);
  db.rutinaAsignada.findMany.mockResolvedValue([{ fechaAsignacion: at("2026-09-30T14:00:00Z"), socioId: "s-marcos", rutinaId: "r-fa" }]);
  db.rutina.findMany.mockResolvedValue([{ id: "r-fa", nombre: "Fuerza A" }]);
  db.rutina.count.mockResolvedValue(124);
  db.ejercicio.count.mockResolvedValue(342);
  db.membresia.findMany.mockResolvedValue([
    { id: "m-pro", nombre: "Pro" },
    ...Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, nombre: `Plan ${i}` })),
  ]);
}

beforeEach(() => {
  jest.resetAllMocks();
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

  it("pagos: solo CONFIRMADOS, Decimal → número, fecha ISO, y la consulta cubre todo el día argentino (36h)", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.pagos[0]).toEqual({ monto: 50, metodoPago: "EFECTIVO", estado: "CONFIRMADO", fecha: "2026-09-30T17:45:00.000Z" });
    expect(p.pagos.every((x) => x.estado === "CONFIRMADO")).toBe(true);
    expect(p.pagos).toHaveLength(6); // 5 de hoy + 1 de ayer; el ANULADO queda fuera
    expect(db.pago.findMany).toHaveBeenCalledTimes(1); // una sola consulta alimenta caja y feed
    const consulta = db.pago.findMany.mock.calls[0][0];
    expect(consulta.where.estado).toEqual({ in: ["CONFIRMADO", "ANULADO"] });
    expect(consulta.where.fechaPago.gte).toEqual(new Date("2026-09-29T06:00:00Z"));
  });

  it("padrón: una cuota (la última) y la última asistencia PERMITIDA por socio; null si nunca vino", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.cuotas).toEqual([{ socioId: "s1", socioNombre: "Marta G.", fechaVencimiento: "2026-10-01T00:00:00.000Z" }]);
    // padrón activo, en el orden de la base: s-elena (dada de baja) queda fuera
    expect(p.ultimasAsistencias).toEqual([
      "2026-09-30T14:00:00.000Z", // s1
      null, // s2: nunca vino
      ...Array(5).fill("2026-09-30T14:00:00.000Z"),
    ]);
    expect(db.asistencia.groupBy.mock.calls[0][0]).toMatchObject({ by: ["socioId"], where: { estado: "PERMITIDO" }, _max: { fechaHora: true } });
    expect(db.cuota.groupBy.mock.calls[0][0]).toMatchObject({ by: ["socioId"], _max: { fechaVencimiento: true } });
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

  it("la ventana de aforo se recorta a 6 h (la consulta no espera a la configuración para saber desde cuándo traer)", async () => {
    db.configuracionDelSistema.findFirst.mockResolvedValue({ capacidadMaxima: 100, periodoGracia: 0, diasInactividad: 15, ventanaAforoMinutos: 720 });
    const p = await buildHomeInternoPayload(NOW);
    expect(p.aforo.asistenciasActivas).toBe(6); // 5 de las 14h + la de las 12:00Z (6 h exactas); la de las 10:00Z queda afuera
    expect(db.asistencia.findMany.mock.calls[0][0].where.fechaHora.gte).toEqual(new Date("2026-09-30T03:00:00Z"));
  });

  it("personal: filtra por el turno vigente (15h ART → TARDE) y solo empleados activos, en una sola consulta con join", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.personal).toEqual([{ rol: "INSTRUCTOR" }, { rol: "RECEPCIONISTA" }]);
    const consulta = db.usuario.findMany.mock.calls.map((c: unknown[]) => c[0]).find((a: { where: Record<string, unknown> }) => "empleado" in a.where);
    expect(consulta.where).toEqual({
      estado: "ACTIVO",
      deletedAt: null,
      empleado: { is: { estadoLaboral: "ACTIVO", turno: "TARDE" } },
    });
  });

  it("contadores: rutinas y ejercicios por conteo; clientes y membresías salen de listas que ya se traen", async () => {
    const p = await buildHomeInternoPayload(NOW);
    // clientes = socios cuyo usuario no está dado de baja: 8 socios − s-elena = 7
    expect(p.contadores).toEqual({ rutinas: 124, ejercicios: 342, clientes: 7, membresias: 15 });
  });

  it("eventos: cinco tipos del feed, más nuevo primero, con el texto de la spec", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.eventos.map((e) => [e.tipo, e.nombre, e.descripcion])).toEqual([
      ["PAGO", "Ana López", "Pago de membresía Pro"], // 17:45
      ["ANULACION_PAGO", "Luis Gómez", "Pago anulado"], // 16:30
      ["ALTA_SOCIO", "Carlos Mendez", "Alta de nuevo socio"], // 16:00
      ["BAJA_SOCIO", "Elena P.", "Baja de socio"], // 15:00
      ["ASIGNACION_RUTINA", "Marcos Sosa", "Rutina asignada: Fuerza A"], // 14:00
      ["PAGO", "Pago sin socio", "Pago registrado"], // 12:00
      ["PAGO", "Pago sin socio", "Pago registrado"], // 11:00
      ["PAGO", "Pablo R.", "Pago registrado"], // 10:00 (sin plan asignado)
      ["PAGO", "Pago sin socio", "Pago registrado"], // 09:00
    ]); // el pago de las 08:00 de ayer (34 h) queda fuera del feed de 24 h
  });

  it("eventos: nunca incluye ingresos (la spec los excluye del feed)", async () => {
    const p = await buildHomeInternoPayload(NOW);
    expect(p.eventos.some((e) => e.tipo === "INGRESO")).toBe(false);
  });

  it("eventos: máximo 50, los más nuevos", async () => {
    db.pago.findMany.mockResolvedValue(
      Array.from({ length: 80 }, (_, i) => ({
        estado: "CONFIRMADO", monto: dec(1), metodoPago: "EFECTIVO", socioId: null,
        fechaPago: new Date(NOW.getTime() - (i + 1) * 60 * 1000),
      }))
    );
    const p = await buildHomeInternoPayload(NOW);
    expect(p.eventos).toHaveLength(50);
    expect(p.eventos[0].fecha).toBe(new Date(NOW.getTime() - 60 * 1000).toISOString());
  });

  it("base vacía: payload válido, sin romper", async () => {
    db.configuracionDelSistema.findFirst.mockResolvedValue(null);
    for (const m of [db.maquina, db.pago, db.socio, db.usuario, db.asistencia, db.rutinaAsignada, db.rutina, db.membresia]) m.findMany.mockResolvedValue([]);
    for (const m of [db.cuota, db.asistencia]) m.groupBy.mockResolvedValue([]);
    for (const m of [db.rutina, db.ejercicio]) m.count.mockResolvedValue(0);
    const p = await buildHomeInternoPayload(NOW);
    expect(p.eventos).toEqual([]);
    expect(p.personal).toEqual([]);
    expect(p.contadores).toEqual({ rutinas: 0, ejercicios: 0, clientes: 0, membresias: 0 });
    expect(p.aforo.asistenciasActivas).toBe(0);
    expect(p.aforo.horas).toHaveLength(9);
  });
});

describe("buildHomeInternoPayload — rendimiento (P-07): pocas idas y vueltas a la base", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todasLasLlamadas = (): [string, any][] =>
    Object.entries(db).flatMap(([modelo, metodos]) =>
      Object.entries(metodos as Record<string, jest.Mock>).flatMap(([metodo, fn]) =>
        fn.mock.calls.map((c) => [`${modelo}.${metodo}`, c[0]] as [string, unknown])
      )
    ) as [string, any][]; // eslint-disable-line @typescript-eslint/no-explicit-any

  it("TODAS las consultas salen juntas, en una sola ronda: ninguna espera a otra", () => {
    // Con consultas que nunca terminan, solo las lanzadas antes de cualquier `await` quedan registradas.
    for (const metodos of Object.values(db)) for (const fn of Object.values(metodos as Record<string, jest.Mock>)) fn.mockReturnValue(new Promise(() => {}));
    void buildHomeInternoPayload(NOW);
    const lanzadas = new Set(todasLasLlamadas().map(([nombre]) => nombre));
    expect([...lanzadas].sort()).toEqual([
      "asistencia.findMany", "asistencia.groupBy", "configuracionDelSistema.findFirst", "cuota.groupBy",
      "ejercicio.count", "maquina.findMany", "membresia.findMany", "pago.findMany", "rutina.count",
      "rutina.findMany", "rutinaAsignada.findMany", "socio.findMany", "usuario.findMany",
    ]);
    expect(todasLasLlamadas()).toHaveLength(14); // 13 modelos/métodos; usuario.findMany se usa dos veces
  });

  it("ninguna consulta anida relaciones en `select` (cada relación anidada es otra consulta, encadenada)", async () => {
    await buildHomeInternoPayload(NOW);
    for (const [nombre, args] of todasLasLlamadas()) {
      const anidadas = Object.entries(args?.select ?? {}).filter(([, v]) => typeof v === "object" && v !== null);
      expect({ nombre, anidadas }).toEqual({ nombre, anidadas: [] });
    }
  });
});

describe("contrato servidor ↔ cliente ↔ dominio (el mismo camino que recorre la página)", () => {
  it("el payload, ya serializado como JSON, produce los números de la spec", async () => {
    const payload = JSON.parse(JSON.stringify(await buildHomeInternoPayload(NOW)));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payload });

    const data = await fetchHomeInternoData();
    const vm = aggregateHomeInterno(data, data.ahora);

    expect(vm.caja).toEqual({ efectivo: 150, transferencia: 200, tarjeta: 0, total: 350 }); // el pago de ayer (999) no cuenta: no es de hoy
    expect(vm.aforo).toMatchObject({ ocupacionActual: 5, capacidadMaxima: 100, porcentaje: 5 });
    expect(vm.equipos).toEqual({ metric: "90%", footer: "2 en mantenimiento" });
    expect(vm.personal).toEqual({ metric: "2", footer: "1 entrenador, 1 staff" });
    expect(vm.inactivos).toEqual({ metric: "1", footer: "Sin visita > 15 días" }); // Juan P.: nunca vino
    expect(vm.alertas.map((a) => a.texto)).toEqual(["Vencimiento · Marta G."]);
    expect(vm.gestion).toEqual({ rutinas: "124", ejercicios: "342", clientes: "7", membresias: "15" });
    expect(vm.actividad.map((a) => a.nombre)).toEqual([
      "Ana López", "Luis Gómez", "Carlos Mendez", "Elena P.", "Marcos Sosa",
      "Pago sin socio", "Pago sin socio", "Pablo R.", "Pago sin socio",
    ]);
  });
});

describe("buildAforoHoras", () => {
  it("las entradas fuera de 06–22 no caen en ninguna franja", () => {
    const { horas } = buildAforoHoras([new Date("2026-09-30T05:00:00Z")], NOW); // 02:00 ART
    expect(horas.every((h) => h.ocupacion === 0)).toBe(true);
  });
});
