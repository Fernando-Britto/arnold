/**
 * Integración sesión ↔ asignaciones (T-056g2, CP4c).
 *
 * Prisma va mockeado con los modelos nuevos; la orquestación (recálculo) también se mockea.
 * `sesion-de-entrenamiento.test.ts` no se toca: ese archivo usa un doble sin los modelos y prueba
 * el camino D-103.
 */
import { iniciarSesion } from "./sesion-de-entrenamiento";
import { calcularYReservar } from "@/domains/asignacion/orquestacion";

jest.mock("@/lib/db", () => {
  const prisma = {
    socio: { findUnique: jest.fn() },
    rutinaAsignada: { findUnique: jest.fn() },
    sesionDeEntrenamiento: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    registroDeProgreso: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    reglaDeProgresion: { findFirst: jest.fn() },
    asignacionDeEjercicio: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    ejercicioMaquina: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  // `tx` es OTRO objeto: comparte los dobles de lectura y de creación (para no reescribir las
  // aserciones existentes) pero tiene su propio `updateMany` de la reserva, que es justo lo que
  // debe probarse dentro de la transacción.
  const tx = {
    sesionDeEntrenamiento: prisma.sesionDeEntrenamiento,
    asignacionDeEjercicio: {
      findFirst: prisma.asignacionDeEjercicio.findFirst,
      create: prisma.asignacionDeEjercicio.create,
      updateMany: jest.fn(),
    },
    ejercicioMaquina: prisma.ejercicioMaquina,
  };
  prisma.$transaction.mockImplementation((ops: unknown) =>
    typeof ops === "function" ? Promise.resolve(ops(tx)) : Promise.all([])
  );
  (prisma as unknown as { __tx: typeof tx }).__tx = tx;
  return { prisma };
});
jest.mock("@/domains/asignacion/orquestacion");

const mockCalcular = calcularYReservar as jest.MockedFunction<typeof calcularYReservar>;

const AHORA = new Date("2026-10-25T10:00:00.000Z");

interface PrismaFalso {
  socio: { findUnique: jest.Mock };
  rutinaAsignada: { findUnique: jest.Mock };
  sesionDeEntrenamiento: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  registroDeProgreso: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
  reglaDeProgresion: { findFirst: jest.Mock };
  asignacionDeEjercicio: { findFirst: jest.Mock; updateMany: jest.Mock; create: jest.Mock };
  ejercicioMaquina: { findMany: jest.Mock };
  $transaction: jest.Mock;
  __tx: TxFalso;
}

interface TxFalso {
  sesionDeEntrenamiento: { updateMany: jest.Mock; create: jest.Mock };
  asignacionDeEjercicio: { findFirst: jest.Mock; updateMany: jest.Mock; create: jest.Mock };
  ejercicioMaquina: { findMany: jest.Mock };
}

async function mocks(): Promise<PrismaFalso> {
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as PrismaFalso;
}

/** Rutina activa de dos ejercicios; E1 es el primero por orden. */
function asignacion() {
  return {
    id: "ra-1",
    socioId: "socio-1",
    activa: true,
    rutina: {
      ejercicios: [
        {
          ejercicioId: "E1",
          series: 2,
          repeticiones: 10,
          descanso: 90,
          orden: 1,
          ejercicio: { id: "E1", nombre: "Sentadilla" },
        },
        {
          ejercicioId: "E2",
          series: 1,
          repeticiones: 10,
          descanso: 60,
          orden: 2,
          ejercicio: { id: "E2", nombre: "Press banca" },
        },
      ],
    },
  };
}

beforeEach(async () => {
  const prisma = await mocks();
  jest.clearAllMocks();
  mockCalcular.mockResolvedValue({ tipo: "fallback", motivo: "SIN_OPCIONES" });

  prisma.socio.findUnique.mockResolvedValue({ id: "socio-1" });
  prisma.rutinaAsignada.findUnique.mockResolvedValue(asignacion());
  prisma.sesionDeEntrenamiento.updateMany.mockResolvedValue({ count: 0 });
  prisma.sesionDeEntrenamiento.create.mockResolvedValue({ id: "s-1" });
  prisma.registroDeProgreso.findMany.mockResolvedValue([]);
  prisma.registroDeProgreso.findFirst.mockResolvedValue(null);
  prisma.reglaDeProgresion.findFirst.mockResolvedValue(null);
  prisma.asignacionDeEjercicio.findFirst.mockResolvedValue(null);
  prisma.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 1 });
  prisma.__tx.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 1 });
  prisma.asignacionDeEjercicio.create.mockResolvedValue({ id: "a-nueva" });
  prisma.ejercicioMaquina.findMany.mockResolvedValue([{ maquinaId: "M1" }]);
});

const iniciar = () =>
  iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "ra-1", ahora: AHORA });

describe("iniciarSesion con asignaciones", () => {
  it("consume la reserva vigente y fija su ejercicio como actual", async () => {
    const prisma = await mocks();
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue({
      id: "a-1",
      ejercicioId: "E2",
      maquinaId: "M2",
    });

    await iniciar();

    expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ejercicioActualId: "E2", serieActual: 1 }),
    });
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
      where: { id: "a-1", estado: "RESERVADA", venceEn: { gt: AHORA } },
      data: { estado: "EN_CURSO", sesionId: "s-1" },
    });
    expect(prisma.asignacionDeEjercicio.create).not.toHaveBeenCalled();
  });

  it("sin reserva y con una sola candidata crea la ejecución EN_CURSO de la máquina", async () => {
    const prisma = await mocks();

    await iniciar();

    expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ejercicioActualId: "E1", serieActual: 1 }),
    });
    expect(prisma.asignacionDeEjercicio.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socioId: "socio-1",
        sesionId: "s-1",
        ejercicioId: "E1",
        maquinaId: "M1",
        estado: "EN_CURSO",
        esperaSegundos: 0,
        ahorroSegundos: 0,
        creadaEn: AHORA,
        venceEn: AHORA,
      }),
    });
  });

  it("sin reserva y con varias candidatas crea la ejecución con maquinaId null", async () => {
    const prisma = await mocks();
    prisma.ejercicioMaquina.findMany.mockResolvedValue([{ maquinaId: "M1" }, { maquinaId: "M2" }]);

    await iniciar();

    expect(prisma.asignacionDeEjercicio.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ maquinaId: null, estado: "EN_CURSO" }),
    });
  });
});

describe("iniciarSesion: reservas que no aplican y fallback", () => {
  it("una reserva vencida no se consume", async () => {
    const prisma = await mocks();
    // La consulta filtra por `venceEn > ahora`: la base no la devuelve.
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue(null);

    await iniciar();

    expect(prisma.asignacionDeEjercicio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: "RESERVADA", venceEn: { gt: AHORA } }),
      })
    );
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).not.toHaveBeenCalled();
    expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ejercicioActualId: "E1" }),
    });
  });

  it("una reserva de un ejercicio fuera de la rutina no se consume", async () => {
    const prisma = await mocks();
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue({
      id: "a-9",
      ejercicioId: "E9",
      maquinaId: "M9",
    });

    await iniciar();

    expect(prisma.__tx.asignacionDeEjercicio.updateMany).not.toHaveBeenCalled();
    expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ejercicioActualId: "E1", serieActual: 1 }),
    });
  });

  it("si el recálculo falla, la sesión se crea igual y se loguea", async () => {
    const prisma = await mocks();
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCalcular.mockRejectedValue(new Error("motor roto"));

    const resultado = await iniciar();

    expect(resultado.sesion).toBeDefined();
    expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "[ASIGNACION][sesion]",
      expect.objectContaining({ socioId: "socio-1", tipo: "error-no-contenido" })
    );
    log.mockRestore();
  });

  it("sin los modelos nuevos (D-103) se comporta como siempre", async () => {
    const prisma = await mocks();
    const cliente = prisma as unknown as Record<string, unknown>;
    const asignacionOriginal = cliente.asignacionDeEjercicio;
    const maquinaOriginal = cliente.ejercicioMaquina;
    delete cliente.asignacionDeEjercicio;
    delete cliente.ejercicioMaquina;

    try {
      await iniciar();

      expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ejercicioActualId: "E1", serieActual: 1 }),
      });
      expect(mockCalcular).not.toHaveBeenCalled();
    } finally {
      cliente.asignacionDeEjercicio = asignacionOriginal;
      cliente.ejercicioMaquina = maquinaOriginal;
    }
  });
});

describe("iniciarSesion: la reserva se consume dentro de la transacción", () => {
  it("el consumo de la reserva corre sobre tx y no sobre el cliente raíz", async () => {
    const prisma = await mocks();
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue({
      id: "a-1",
      ejercicioId: "E2",
      maquinaId: "M2",
    });

    await iniciar();

    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.asignacionDeEjercicio.updateMany).not.toHaveBeenCalled();
  });
});
