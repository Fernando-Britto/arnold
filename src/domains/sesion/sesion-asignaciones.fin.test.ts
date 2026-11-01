/**
 * Fin de sesión con asignaciones (T-056g3b, CP4c).
 *
 * `finalizarSesion` debe completar las filas `EN_CURSO` de la sesión en la MISMA transacción que
 * actualiza la sesión. Sin los modelos nuevos, el camino es el de siempre (D-103).
 */
import { finalizarSesion } from "./sesion-de-entrenamiento";
import { configurarDobles, mocks } from "../../../tests/factories/sesion-asignaciones-dobles";

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@/lib/db", () => require("../../../tests/factories/sesion-asignaciones-dobles").crearModuloDb());

const AHORA = new Date("2026-10-25T11:00:00.000Z");

function sesion(overrides: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    socioId: "socio-1",
    estadoDeFinalizacion: "EN_CURSO",
    ejercicioActualId: null,
    serieActual: null,
    ...overrides,
  };
}

beforeEach(async () => {
  const prisma = await mocks();
  jest.clearAllMocks();
  configurarDobles(prisma);
  prisma.sesionDeEntrenamiento.findUnique.mockResolvedValue(sesion());
  prisma.sesionDeEntrenamiento.update.mockResolvedValue(sesion({ estadoDeFinalizacion: "COMPLETADA" }));
  prisma.__tx.sesionDeEntrenamiento.update.mockResolvedValue(
    sesion({ estadoDeFinalizacion: "COMPLETADA" })
  );
  prisma.__tx.asignacionDeEjercicio.updateMany.mockResolvedValue({ count: 2 });
});

describe("finalizarSesion con asignaciones", () => {
  it("completa las EN_CURSO restantes en la misma transacción de la sesión", async () => {
    const prisma = await mocks();

    await finalizarSesion({ sesionId: "s-1", ahora: AHORA });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.sesionDeEntrenamiento.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { horaFin: AHORA, estadoDeFinalizacion: "COMPLETADA" },
    });
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).toHaveBeenCalledWith({
      where: { sesionId: "s-1", estado: "EN_CURSO" },
      data: { estado: "COMPLETADA" },
    });
    // Nada se escribe sobre el cliente raíz.
    expect(prisma.sesionDeEntrenamiento.update).not.toHaveBeenCalled();
    expect(prisma.asignacionDeEjercicio.updateMany).not.toHaveBeenCalled();
  });

  it("una sesión ya finalizada no toca asignaciones", async () => {
    const prisma = await mocks();
    prisma.sesionDeEntrenamiento.findUnique.mockResolvedValue(
      sesion({ estadoDeFinalizacion: "COMPLETADA" })
    );

    await finalizarSesion({ sesionId: "s-1", ahora: AHORA });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.__tx.asignacionDeEjercicio.updateMany).not.toHaveBeenCalled();
  });

  it("sin los modelos nuevos (D-103) se comporta como siempre", async () => {
    const prisma = await mocks();
    const cliente = prisma as unknown as Record<string, unknown>;
    const asignacionOriginal = cliente.asignacionDeEjercicio;
    const maquinaOriginal = cliente.ejercicioMaquina;
    delete cliente.asignacionDeEjercicio;
    delete cliente.ejercicioMaquina;

    try {
      await finalizarSesion({ sesionId: "s-1", ahora: AHORA });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.sesionDeEntrenamiento.update).toHaveBeenCalledWith({
        where: { id: "s-1" },
        data: { horaFin: AHORA, estadoDeFinalizacion: "COMPLETADA" },
      });
    } finally {
      cliente.asignacionDeEjercicio = asignacionOriginal;
      cliente.ejercicioMaquina = maquinaOriginal;
    }
  });
});
