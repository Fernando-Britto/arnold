/**
 * Integración sesión ↔ asignaciones (T-056g2, CP4c).
 *
 * Prisma va mockeado con los modelos nuevos; la orquestación (recálculo) también se mockea.
 * `sesion-de-entrenamiento.test.ts` no se toca: ese archivo usa un doble sin los modelos y prueba
 * el camino D-103.
 */
import { iniciarSesion } from "./sesion-de-entrenamiento";
import { calcularYReservar } from "@/domains/asignacion/orquestacion";
import {
  configurarDobles,
  mocks,
} from "../../../tests/factories/sesion-asignaciones-dobles";

// El factory de `jest.mock` se iza por encima de los imports: la única forma de reusar el doble
// compartido es requerirlo dentro del factory.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@/lib/db", () => require("../../../tests/factories/sesion-asignaciones-dobles").crearModuloDb());
jest.mock("@/domains/asignacion/orquestacion");

const mockCalcular = calcularYReservar as jest.MockedFunction<typeof calcularYReservar>;

const AHORA = new Date("2026-10-25T10:00:00.000Z");

beforeEach(async () => {
  const prisma = await mocks();
  jest.clearAllMocks();
  mockCalcular.mockResolvedValue({ tipo: "fallback", motivo: "SIN_OPCIONES" });
  configurarDobles(prisma);
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

describe("iniciarSesion: la reserva ya no se puede consumir", () => {
  it("con count 0 pasa al primer ejercicio y crea su fila EN_CURSO", async () => {
    const prisma = await mocks();
    prisma.asignacionDeEjercicio.findFirst.mockResolvedValue({
      id: "a-1",
      ejercicioId: "E2",
      maquinaId: "M2",
    });
    prisma.__tx.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 0 });

    await iniciar();

    expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ejercicioActualId: "E2", serieActual: 1 }),
    });
    expect(prisma.sesionDeEntrenamiento.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { ejercicioActualId: "E1", serieActual: 1 },
    });
    expect(prisma.asignacionDeEjercicio.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ejercicioId: "E1",
        maquinaId: "M1",
        estado: "EN_CURSO",
        esperaSegundos: 0,
        ahorroSegundos: 0,
      }),
    });
    // La reserva no se toca más allá del intento guardado: sigue como estaba.
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.asignacionDeEjercicio.updateMany).not.toHaveBeenCalled();
  });
});
