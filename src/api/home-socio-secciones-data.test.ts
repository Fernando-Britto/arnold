import { buildHomeSocioSeccionesPayload } from "./home-socio-secciones-data";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    socio: { findUnique: jest.fn() },
    configuracionDelSistema: { findFirst: jest.fn() },
    rutinaAsignada: { findMany: jest.fn() },
    sesionDeEntrenamiento: { findMany: jest.fn(), findFirst: jest.fn() },
    registroDeProgreso: { findMany: jest.fn() },
    pago: { findMany: jest.fn() },
    cuota: { findFirst: jest.fn() },
    asistencia: { findMany: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// Miércoles 07/10/2026 12:00 en Argentina (UTC-3)
const NOW = new Date("2026-10-07T15:00:00Z");
const dec = (n: number) => ({ toString: () => n.toFixed(2) }); // imita Prisma.Decimal
const at = (iso: string) => new Date(iso);

function seed() {
  db.socio.findUnique.mockResolvedValue({ id: "socio-1", membresiaAsignada: { nombre: "Premium" } });
  db.configuracionDelSistema.findFirst.mockResolvedValue({ diaLimitePago: 10, periodoGracia: 0 });
  db.rutinaAsignada.findMany.mockResolvedValue([
    {
      id: "ra1",
      fechaAsignacion: at("2026-09-01T15:00:00Z"),
      rutinaId: "r1",
      rutina: {
        nombre: "Fuerza A",
        ejercicios: [
          { series: 3, repeticiones: 10, descanso: 120, ejercicio: { id: "e1", nombre: "Press banca", grupoMuscular: "Pecho", descripcion: "Con barra" } },
          { series: 4, repeticiones: 8, descanso: 90, ejercicio: { id: "e2", nombre: "Remo", grupoMuscular: "Espalda", descripcion: null } },
        ],
      },
    },
  ]);
  db.sesionDeEntrenamiento.findMany.mockResolvedValue([
    { id: "s1", horaInicio: at("2026-10-06T13:00:00Z"), horaFin: at("2026-10-06T14:05:00Z"), estadoDeFinalizacion: "COMPLETADA" },
    { id: "s2", horaInicio: at("2026-10-07T13:00:00Z"), horaFin: null, estadoDeFinalizacion: "EN_CURSO" },
  ]);
  db.sesionDeEntrenamiento.findFirst.mockResolvedValue({
    id: "s2",
    horaInicio: at("2026-10-07T13:00:00Z"),
    ejercicioActualId: "e1",
    serieActual: 2,
  });
  db.registroDeProgreso.findMany.mockResolvedValue([
    { carga: dec(60), repeticiones: 10, fecha: at("2026-09-22T15:00:00Z"), ejercicio: { id: "e1", nombre: "Press banca" } },
    { carga: dec(65), repeticiones: 8, fecha: at("2026-10-05T15:00:00Z"), ejercicio: { id: "e1", nombre: "Press banca" } },
  ]);
  db.pago.findMany.mockResolvedValue([
    {
      id: "p1",
      fechaPago: at("2026-10-02T13:00:00Z"),
      monto: dec(100),
      metodoPago: "EFECTIVO",
      cuota: { fechaVencimiento: at("2026-10-31T23:59:59.999-03:00") },
    },
  ]);
  db.cuota.findFirst.mockResolvedValue({ fechaVencimiento: at("2026-10-31T23:59:59.999-03:00") });
  db.asistencia.findMany.mockResolvedValue([
    { fechaHora: at("2026-10-07T13:00:00Z") },
    { fechaHora: at("2026-10-05T13:00:00Z") },
    { fechaHora: at("2026-10-01T13:00:00Z") },
    { fechaHora: at("2026-09-22T13:00:00Z") },
  ]);
}

describe("buildHomeSocioSeccionesPayload", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("devuelve null si el usuario no tiene perfil de socio", async () => {
    db.socio.findUnique.mockResolvedValue(null);
    expect(await buildHomeSocioSeccionesPayload("u-staff", NOW)).toBeNull();
  });

  it("rutina y ejercicios con la mejor marca por ejercicio (null si no hay registros)", async () => {
    seed();
    const res = await buildHomeSocioSeccionesPayload("u1", NOW);
    expect(res?.rutina).toMatchObject({ nombre: "Fuerza A", rutinaAsignadaId: "ra1" });
    expect(res?.ejercicios.map((e) => [e.nombre, e.mejorMarca])).toEqual([
      ["Press banca", 65],
      ["Remo", null],
    ]);
    expect(res?.ejercicios[0]).toMatchObject({ series: 3, repeticiones: 10, descanso: 120, grupoMuscular: "Pecho" });
  });

  it("historial de sesiones con duración y sesión en curso para retomar", async () => {
    seed();
    const res = await buildHomeSocioSeccionesPayload("u1", NOW);
    expect(res?.sesiones).toEqual([
      { id: "s1", horaInicio: "2026-10-06T13:00:00.000Z", horaFin: "2026-10-06T14:05:00.000Z", estado: "COMPLETADA", duracionMin: 65 },
      { id: "s2", horaInicio: "2026-10-07T13:00:00.000Z", horaFin: null, estado: "EN_CURSO", duracionMin: null },
    ]);
    expect(res?.sesionEnCurso).toEqual({
      id: "s2",
      horaInicio: "2026-10-07T13:00:00.000Z",
      ejercicioActualId: "e1",
      serieActual: 2,
    });
  });

  it("progreso: serie por ejercicio con mejor marca y delta", async () => {
    seed();
    const res = await buildHomeSocioSeccionesPayload("u1", NOW);
    expect(res?.progreso).toEqual([
      {
        ejercicioId: "e1",
        ejercicioNombre: "Press banca",
        serie: [
          { fecha: "2026-09-22", carga: 60 },
          { fecha: "2026-10-05", carga: 65 },
        ],
        mejorMarca: 65,
        delta: 5,
      },
    ]);
  });

  it("membresía: historial, cobertura y estado calculado (AL_DIA)", async () => {
    seed();
    const res = await buildHomeSocioSeccionesPayload("u1", NOW);
    expect(res?.membresia).toMatchObject({
      planNombre: "Premium",
      estado: "AL_DIA",
      ultimoPeriodoCubierto: "2026-10",
      fechaVencimiento: "2026-11-01T02:59:59.999Z",
    });
    expect(res?.membresia?.historial).toEqual([
      { id: "p1", fechaPago: "2026-10-02T13:00:00.000Z", monto: 100, metodoPago: "EFECTIVO", periodo: "2026-10" },
    ]);
  });

  it("asistencias: racha y calendario de 35 días en hora Argentina", async () => {
    seed();
    const res = await buildHomeSocioSeccionesPayload("u1", NOW);
    expect(res?.asistencias.rachaSemanas).toBe(3);
    expect(res?.asistencias.total).toBe(4);
    expect(res?.asistencias.dias).toHaveLength(35);
    expect(res?.asistencias.dias[res.asistencias.dias.length - 1]).toEqual({ fecha: "2026-10-07", asistio: true });
  });

  it("todas las consultas del socio van filtradas por su socioId", async () => {
    seed();
    await buildHomeSocioSeccionesPayload("u1", NOW);
    for (const m of [
      db.rutinaAsignada.findMany,
      db.sesionDeEntrenamiento.findMany,
      db.sesionDeEntrenamiento.findFirst,
      db.registroDeProgreso.findMany,
      db.pago.findMany,
      db.cuota.findFirst,
      db.asistencia.findMany,
    ]) {
      expect(m.mock.calls[0][0].where.socioId).toBe("socio-1");
    }
    expect(db.rutinaAsignada.findMany.mock.calls[0][0].where.activa).toBe(true);
    expect(db.asistencia.findMany.mock.calls[0][0].where.estado).toBe("PERMITIDO");
  });

  it("estados vacíos: sin rutina, sin sesiones, sin progreso, sin membresía ni pagos", async () => {
    seed();
    db.socio.findUnique.mockResolvedValue({ id: "socio-1", membresiaAsignada: null });
    db.rutinaAsignada.findMany.mockResolvedValue([]);
    db.sesionDeEntrenamiento.findMany.mockResolvedValue([]);
    db.sesionDeEntrenamiento.findFirst.mockResolvedValue(null);
    db.registroDeProgreso.findMany.mockResolvedValue([]);
    db.pago.findMany.mockResolvedValue([]);
    db.cuota.findFirst.mockResolvedValue(null);
    db.asistencia.findMany.mockResolvedValue([]);

    const res = await buildHomeSocioSeccionesPayload("u1", NOW);
    expect(res).toMatchObject({
      rutina: null,
      sesiones: [],
      sesionEnCurso: null,
      ejercicios: [],
      progreso: [],
      membresia: null,
      asistencias: { rachaSemanas: 0, total: 0 },
    });
    expect(res?.asistencias.dias).toHaveLength(35);
  });

  it("sin configuración del sistema usa el día límite 10 y gracia 0 (D-40)", async () => {
    seed();
    db.configuracionDelSistema.findFirst.mockResolvedValue(null);
    db.cuota.findFirst.mockResolvedValue({ fechaVencimiento: at("2026-09-30T23:59:59.999-03:00") });
    const res = await buildHomeSocioSeccionesPayload("u1", NOW);
    expect(res?.membresia?.estado).toBe("PENDIENTE");
  });
});
