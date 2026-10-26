/**
 * Balance muscular del socio desde el historial (T-051 parte 2, D-107). Prisma va mockeado.
 */
import { balanceMuscularDelSocio } from "./balance-muscular-datos";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    registroDeProgreso: { groupBy: jest.fn() },
    ejercicio: { findMany: jest.fn() },
  };
  return { prisma };
});

async function mocks() {
  const { prisma } = await import("@/lib/db");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma as any;
}

const AHORA = new Date("2026-10-15T17:00:00.000Z");

const pressBanca = {
  id: "e1",
  grupoMuscular: "Pecho",
  musculoObjetivo: "Pectorales",
  musculosSecundarios: ["Tríceps", "Hombros"],
};
const sentadilla = { id: "e2", grupoMuscular: "Piernas", musculoObjetivo: "Cuádriceps", musculosSecundarios: ["Glúteos"] };
const bicicleta = {
  id: "e3",
  grupoMuscular: "Cardio",
  musculoObjetivo: "Sistema cardiovascular",
  musculosSecundarios: ["Cuádriceps", "Gemelos"],
};

const grupo = (ejercicioId: string, cantidad: number) => ({ ejercicioId, _count: { _all: cantidad } });

beforeEach(async () => {
  jest.clearAllMocks();
  const prisma = await mocks();
  prisma.registroDeProgreso.groupBy.mockReset().mockResolvedValue([]);
  prisma.ejercicio.findMany.mockReset().mockResolvedValue([]);
});

describe("balanceMuscularDelSocio", () => {
  it("cuenta solo las series de trabajo del propio socio: sin calentamientos ni drop sets", async () => {
    const prisma = await mocks();

    await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "todo", ahora: AHORA });

    expect(prisma.registroDeProgreso.groupBy).toHaveBeenCalledWith({
      by: ["ejercicioId"],
      where: { socioId: "socio-1", tipo: { notIn: ["CALENTAMIENTO", "DROP_SET"] } },
      _count: { _all: true },
    });
  });

  it("limita por fecha según el período: la semana arranca al inicio del día de hace 6 días", async () => {
    const prisma = await mocks();

    await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "semana", ahora: AHORA });

    expect(prisma.registroDeProgreso.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fecha: { gte: new Date("2026-10-09T03:00:00.000Z") } }),
      })
    );
  });

  it("'todo' no pone límite de fecha", async () => {
    const prisma = await mocks();

    await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "todo", ahora: AHORA });

    expect(prisma.registroDeProgreso.groupBy.mock.calls[0][0].where).not.toHaveProperty("fecha");
  });

  it("sin series en el período devuelve un balance vacío y no consulta los ejercicios", async () => {
    const prisma = await mocks();

    const b = await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "30d", ahora: AHORA });

    expect(b.musculos).toEqual([]);
    expect(b.totalSeries).toBe(0);
    expect(b.sinTrabajar).toHaveLength(18);
    expect(prisma.ejercicio.findMany).not.toHaveBeenCalled();
  });

  it("pide los músculos solo de los ejercicios que el socio entrenó", async () => {
    const prisma = await mocks();
    prisma.registroDeProgreso.groupBy.mockResolvedValue([grupo("e1", 4), grupo("e2", 3)]);
    prisma.ejercicio.findMany.mockResolvedValue([pressBanca, sentadilla]);

    await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "todo", ahora: AHORA });

    expect(prisma.ejercicio.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1", "e2"] } },
      select: { id: true, grupoMuscular: true, musculoObjetivo: true, musculosSecundarios: true },
    });
  });

  it("el volumen sale de las series de cada ejercicio por el peso de cada músculo", async () => {
    const prisma = await mocks();
    prisma.registroDeProgreso.groupBy.mockResolvedValue([grupo("e1", 4), grupo("e2", 3)]);
    prisma.ejercicio.findMany.mockResolvedValue([pressBanca, sentadilla]);

    const b = await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "semana", ahora: AHORA });

    expect(b.musculos.map((m) => [m.musculo, m.series])).toEqual([
      ["pecho", 4],
      ["cuadriceps", 3],
      // Con el mismo volumen manda el orden del cuerpo, de la cabeza a los pies.
      ["deltoides", 1.6],
      ["triceps", 1.6],
      ["gluteos", 1.2],
    ]);
    expect(b.musculos[0].intensidad).toBe(1);
    expect(b.periodo).toBe("semana");
    expect(b.desde).toEqual(new Date("2026-10-09T03:00:00.000Z"));
  });

  it("el total son las series reales de fuerza, no las ponderadas", async () => {
    const prisma = await mocks();
    prisma.registroDeProgreso.groupBy.mockResolvedValue([grupo("e1", 4), grupo("e2", 3)]);
    prisma.ejercicio.findMany.mockResolvedValue([pressBanca, sentadilla]);

    const b = await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "todo", ahora: AHORA });

    expect(b.totalSeries).toBe(7);
  });

  it("el cardio no suma ni al volumen ni al total de series", async () => {
    const prisma = await mocks();
    prisma.registroDeProgreso.groupBy.mockResolvedValue([grupo("e1", 4), grupo("e3", 10)]);
    prisma.ejercicio.findMany.mockResolvedValue([pressBanca, bicicleta]);

    const b = await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "todo", ahora: AHORA });

    expect(b.totalSeries).toBe(4);
    expect(b.musculos.map((m) => m.musculo)).not.toContain("gemelos");
  });

  it("un ejercicio sin músculos (cargado a mano) usa su grupo muscular", async () => {
    const prisma = await mocks();
    prisma.registroDeProgreso.groupBy.mockResolvedValue([grupo("e9", 5)]);
    prisma.ejercicio.findMany.mockResolvedValue([
      { id: "e9", grupoMuscular: "Brazos", musculoObjetivo: null, musculosSecundarios: [] },
    ]);

    const b = await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "todo", ahora: AHORA });

    expect(b.musculos.map((m) => [m.musculo, m.series])).toEqual([
      ["biceps", 2.5],
      ["triceps", 2.5],
    ]);
  });

  it("si un ejercicio ya no existe lo saltea sin romper el resto", async () => {
    const prisma = await mocks();
    prisma.registroDeProgreso.groupBy.mockResolvedValue([grupo("e1", 4), grupo("borrado", 6)]);
    prisma.ejercicio.findMany.mockResolvedValue([pressBanca]);

    const b = await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "todo", ahora: AHORA });

    expect(b.totalSeries).toBe(4);
    expect(b.musculos[0].musculo).toBe("pecho");
  });

  it("sin `ahora` usa la hora actual", async () => {
    const prisma = await mocks();

    await balanceMuscularDelSocio({ socioId: "socio-1", periodo: "semana" });

    const { gte } = prisma.registroDeProgreso.groupBy.mock.calls[0][0].where.fecha;
    expect(gte).toBeInstanceOf(Date);
    expect(Date.now() - gte.getTime()).toBeLessThan(7 * 24 * 3600 * 1000);
  });
});
