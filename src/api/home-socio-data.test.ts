import { buildHomeSocioPayload } from "./home-socio-data";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    socio: { findUnique: jest.fn() },
    configuracionDelSistema: { findFirst: jest.fn() },
    asistencia: { findMany: jest.fn() },
    registroDeProgreso: { findMany: jest.fn() },
    reglaDeProgresion: { findFirst: jest.fn() },
    rutinaAsignada: { findMany: jest.fn() },
    sesionDeEntrenamiento: { findFirst: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// Miércoles 07/10/2026 12:00 en Argentina (UTC-3)
const NOW = new Date("2026-10-07T15:00:00Z");
const dec = (n: number) => ({ toString: () => n.toFixed(2) }); // imita Prisma.Decimal
const at = (iso: string) => new Date(iso);

const SOCIO = {
  id: "socio-1",
  membresiaAsignada: { nombre: "Premium", periodicidad: 30 },
  cuotas: [{ fechaVencimiento: at("2026-10-20T03:00:00Z") }],
};

function seed() {
  db.socio.findUnique.mockResolvedValue(SOCIO);
  db.configuracionDelSistema.findFirst.mockResolvedValue({ capacidadMaxima: 50, ventanaAforoMinutos: 90 });
  db.asistencia.findMany.mockImplementation(async (args: { where: { socioId?: string } }) =>
    args.where.socioId
      ? [
          // fechas del socio (hora Argentina): mié 7/10, lun 5/10, jue 1/10, mar 22/9
          { fechaHora: at("2026-10-07T13:00:00Z") },
          { fechaHora: at("2026-10-05T13:00:00Z") },
          { fechaHora: at("2026-10-01T13:00:00Z") },
          { fechaHora: at("2026-09-22T13:00:00Z") },
        ]
      : [
          // asistencias del gimnasio (todas las personas)
          { fechaHora: at("2026-10-07T14:00:00Z") }, // 11:00 → dentro de la ventana
          { fechaHora: at("2026-10-07T14:30:00Z") }, // 11:30 → dentro
          { fechaHora: at("2026-10-07T12:00:00Z") }, // 09:00 → hoy, fuera de la ventana
          { fechaHora: at("2026-10-06T20:00:00Z") }, // ayer
        ]
  );
  db.registroDeProgreso.findMany.mockResolvedValue([
    { carga: dec(60), fecha: at("2026-09-22T15:00:00Z"), ejercicio: { id: "e1", nombre: "Press banca" } },
    { carga: dec(65), fecha: at("2026-10-05T15:00:00Z"), ejercicio: { id: "e1", nombre: "Press banca" } },
  ]);
  db.reglaDeProgresion.findFirst.mockResolvedValue({ incrementoSugerido: dec(5) });
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
  db.sesionDeEntrenamiento.findFirst.mockResolvedValue({ id: "s1" });
}

describe("buildHomeSocioPayload", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("devuelve null si el usuario no tiene perfil de socio", async () => {
    db.socio.findUnique.mockResolvedValue(null);
    expect(await buildHomeSocioPayload("u-staff", NOW)).toBeNull();
    expect(db.socio.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: "u-staff" } })
    );
  });

  it("aforo: mismo cálculo que Home_Interno (AC-005)", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.aforo).toMatchObject({ ocupacionActual: 2, capacidadMaxima: 50, horaActual: 12 });
    const barra = (h: number) => res?.aforo.horas.find((x) => x.hora === h)?.ocupacion;
    expect(barra(10)).toBe(2);
    expect(barra(8)).toBe(1);
  });

  it("racha semanal sobre semana calendario Lun–Dom en hora Argentina (AC-006)", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.racha.semanasRacha).toBe(3);
    expect(res?.racha.dias.map((d) => d.numero)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(res?.racha.dias.map((d) => d.asistio)).toEqual([true, false, true, false, false, false, false]);
    expect(res?.racha.dias[2].esHoy).toBe(true);
  });

  it("membresía: plan, vencimiento y grilla de 28 días", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.membresia).toMatchObject({
      planNombre: "Premium",
      fechaVencimiento: "2026-10-20T03:00:00.000Z",
      diasTotalMembresia: 30,
      totalAsistencias28Dias: 4,
    });
    expect(res?.membresia?.dias28).toHaveLength(28);
    expect(res?.membresia?.dias28.filter(Boolean)).toHaveLength(4);
  });

  it("progreso usa la regla de progresión configurada", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.progreso).toMatchObject({
      ejercicioNombre: "Press banca",
      marcaActual: 65,
      deltaEsteMes: 5,
      proximaSesionSugerida: 70,
    });
  });

  it("rutina activa con ejercicios en orden y sesión en progreso", async () => {
    seed();
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.rutinaActiva?.nombre).toBe("Fuerza A");
    expect(res?.rutinaActiva?.indiceActual).toBe(0);
    expect(res?.rutinaActiva?.ejercicios.map((e) => e.nombre)).toEqual(["Press banca", "Remo"]);
    expect(res?.rutinaActiva?.ejercicios[0]).toEqual({
      id: "e1", nombre: "Press banca", grupoMuscular: "Pecho", descripcion: "Con barra",
      series: 3, repeticiones: 10, descanso: 120,
    });
    expect(res?.sesionEnProgreso).toBe(true);
  });

  it("todas las consultas del socio van filtradas por su socioId", async () => {
    seed();
    await buildHomeSocioPayload("u1", NOW);
    for (const m of [db.registroDeProgreso.findMany, db.rutinaAsignada.findMany, db.sesionDeEntrenamiento.findFirst]) {
      expect(m.mock.calls[0][0].where.socioId).toBe("socio-1");
    }
    expect(db.rutinaAsignada.findMany.mock.calls[0][0].where.activa).toBe(true);
    const socioCall = db.asistencia.findMany.mock.calls.find((c: [{ where: { socioId?: string } }]) => c[0].where.socioId);
    expect(socioCall[0].where).toMatchObject({ socioId: "socio-1", estado: "PERMITIDO" });
  });

  it("estados vacíos: sin rutina, sin progreso, sin membresía ni cuota", async () => {
    seed();
    db.socio.findUnique.mockResolvedValue({ id: "socio-1", membresiaAsignada: null, cuotas: [] });
    db.registroDeProgreso.findMany.mockResolvedValue([]);
    db.rutinaAsignada.findMany.mockResolvedValue([]);
    db.sesionDeEntrenamiento.findFirst.mockResolvedValue(null);
    db.reglaDeProgresion.findFirst.mockResolvedValue(null);

    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res).toMatchObject({ progreso: null, rutinaActiva: null, membresia: null, sesionEnProgreso: false });
  });

  it("sin configuración del sistema: capacidad 0 en vez de romper", async () => {
    seed();
    db.configuracionDelSistema.findFirst.mockResolvedValue(null);
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.aforo.capacidadMaxima).toBe(0);
  });

  it("más de una rutina activa (RN-04): usa la más antigua y avisa (AC-002)", async () => {
    seed();
    db.rutinaAsignada.findMany.mockResolvedValue([
      { id: "ra2", fechaAsignacion: at("2026-09-20T15:00:00Z"), rutinaId: "r2", rutina: { nombre: "Nueva", ejercicios: [] } },
      { id: "ra1", fechaAsignacion: at("2026-09-01T15:00:00Z"), rutinaId: "r1", rutina: { nombre: "Vieja", ejercicios: [] } },
    ]);
    const res = await buildHomeSocioPayload("u1", NOW);
    expect(res?.rutinaActiva?.nombre).toBe("Vieja");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("ROUTINE_INTEGRITY_ERROR"), expect.anything());
  });
});
