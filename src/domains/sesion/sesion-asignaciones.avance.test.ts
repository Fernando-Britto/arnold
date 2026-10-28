/**
 * Avance de sesión con asignaciones (T-056g3a, CP4c): última serie de trabajo.
 *
 * Prisma y la orquestación van mockeados con los dobles compartidos de
 * `tests/factories/sesion-asignaciones-dobles.ts`.
 */
import { registrarSerie } from "./sesion-de-entrenamiento";
import { calcularYReservar } from "@/domains/asignacion/orquestacion";
import {
  configurarDobles,
  mocks,
} from "../../../tests/factories/sesion-asignaciones-dobles";

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@/lib/db", () => require("../../../tests/factories/sesion-asignaciones-dobles").crearModuloDb());
jest.mock("@/domains/asignacion/orquestacion");

const mockCalcular = calcularYReservar as jest.MockedFunction<typeof calcularYReservar>;

const AHORA = new Date("2026-10-25T10:05:00.000Z");

function sesion(overrides: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    socioId: "socio-1",
    estadoDeFinalizacion: "EN_CURSO",
    ejercicioActualId: "E1",
    serieActual: 2,
    rutinaAsignada: {
      rutina: {
        ejercicios: [
          { ejercicioId: "E1", series: 2, repeticiones: 10, descanso: 90, orden: 1 },
          { ejercicioId: "E2", series: 1, repeticiones: 10, descanso: 60, orden: 2 },
        ],
      },
    },
    ...overrides,
  };
}

const serie = (overrides: Record<string, unknown> = {}) => ({
  sesionId: "s-1",
  ejercicioId: "E1",
  carga: 40,
  repeticiones: 10,
  ahora: AHORA,
  ...overrides,
});

beforeEach(async () => {
  const prisma = await mocks();
  jest.clearAllMocks();
  mockCalcular.mockResolvedValue({ tipo: "fallback", motivo: "SIN_OPCIONES" });
  configurarDobles(prisma);
  prisma.sesionDeEntrenamiento.findUnique.mockResolvedValue(sesion());
  prisma.registroDeProgreso.create.mockResolvedValue({ fecha: AHORA });
  prisma.sesionDeEntrenamiento.updateMany.mockResolvedValue({ count: 1 });
});

describe("registrarSerie: última serie con reserva del siguiente", () => {
  it("consume la reserva, avanza a E2 y completa la ejecución de E1", async () => {
    const prisma = await mocks();
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue({
      id: "a-2",
      ejercicioId: "E2",
      maquinaId: "M2",
    });

    await registrarSerie(serie());

    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "s-1", serieActual: 2 }),
      data: { ejercicioActualId: "E2", serieActual: 1 },
    });
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
      where: { id: "a-2", estado: "RESERVADA", venceEn: { gt: AHORA } },
      data: { estado: "EN_CURSO", sesionId: "s-1" },
    });
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
      where: { sesionId: "s-1", ejercicioId: "E1", estado: "EN_CURSO" },
      data: { estado: "COMPLETADA" },
    });
    expect(prisma.asignacionDeEjercicio.create).not.toHaveBeenCalled();
    expect(mockCalcular).toHaveBeenCalledWith(
      expect.objectContaining({ momento: "POST_EJERCICIO", excluirEjercicioIds: ["E1"] })
    );
  });

  it("sin reserva avanza por orden de rutina y crea la fila EN_CURSO de E2", async () => {
    const prisma = await mocks();
    prisma.ejercicioMaquina.findMany.mockResolvedValue([{ maquinaId: "M2" }]);

    await registrarSerie(serie());

    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "s-1" }),
      data: { ejercicioActualId: "E2", serieActual: 1 },
    });
    expect(prisma.asignacionDeEjercicio.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ejercicioId: "E2",
        maquinaId: "M2",
        estado: "EN_CURSO",
        esperaSegundos: 0,
        ahorroSegundos: 0,
      }),
    });
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
      where: { sesionId: "s-1", ejercicioId: "E1", estado: "EN_CURSO" },
      data: { estado: "COMPLETADA" },
    });
  });

  it("la última serie del último ejercicio no crea fila y deja serieActual null", async () => {
    const prisma = await mocks();
    prisma.sesionDeEntrenamiento.findUnique.mockResolvedValue(
      sesion({ ejercicioActualId: "E2", serieActual: 1 })
    );

    await registrarSerie(serie({ ejercicioId: "E2" }));

    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "s-1" }),
      data: { ejercicioActualId: null, serieActual: null },
    });
    expect(prisma.asignacionDeEjercicio.create).not.toHaveBeenCalled();
  });
});

describe("registrarSerie: calentamiento, convivencia y fallback", () => {
  it("un calentamiento no consume reserva ni recalcula", async () => {
    const prisma = await mocks();
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue({
      id: "a-2",
      ejercicioId: "E2",
      maquinaId: "M2",
    });

    await registrarSerie(serie({ tipo: "CALENTAMIENTO" }));

    expect(prisma.asignacionDeEjercicio.findFirst).not.toHaveBeenCalled();
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).not.toHaveBeenCalled();
    expect(prisma.asignacionDeEjercicio.create).not.toHaveBeenCalled();
    expect(mockCalcular).not.toHaveBeenCalled();
    expect(prisma.sesionDeEntrenamiento.updateMany).not.toHaveBeenCalled();
  });

  it("tras avanzar conviven una fila EN_CURSO y la reserva consumida, sin tocar otras", async () => {
    const prisma = await mocks();
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue({
      id: "a-2",
      ejercicioId: "E2",
      maquinaId: "M2",
    });

    await registrarSerie(serie());

    // Exactamente dos escrituras sobre asignaciones: consumir la reserva y completar la anterior.
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledTimes(2);
    const wheres = prisma.__tx.asignacionDeEjercicio.updateMany.mock.calls.map(
      ([args]: [{ where: Record<string, unknown> }]) => args.where
    );
    expect(wheres).toEqual([
      { id: "a-2", estado: "RESERVADA", venceEn: { gt: AHORA } },
      { sesionId: "s-1", ejercicioId: "E1", estado: "EN_CURSO" },
    ]);
  });

  it("sin los modelos nuevos (D-103) avanza por orden y no toca asignaciones", async () => {
    const prisma = await mocks();
    const cliente = prisma as unknown as Record<string, unknown>;
    const asignacionOriginal = cliente.asignacionDeEjercicio;
    const maquinaOriginal = cliente.ejercicioMaquina;
    delete cliente.asignacionDeEjercicio;
    delete cliente.ejercicioMaquina;

    try {
      await registrarSerie(serie());

      expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: "s-1" }),
        data: { ejercicioActualId: "E2", serieActual: 1 },
      });
      expect(mockCalcular).not.toHaveBeenCalled();
    } finally {
      cliente.asignacionDeEjercicio = asignacionOriginal;
      cliente.ejercicioMaquina = maquinaOriginal;
    }
  });
});
