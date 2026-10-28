/**
 * Dobles compartidos de la integración sesión ↔ asignaciones (T-056g).
 *
 * `tx` es OTRO objeto que el cliente raíz: comparte los dobles de lectura y de creación, pero tiene
 * su propio `updateMany` de la reserva, que es justo lo que debe probarse dentro de la transacción.
 */

export interface TxFalso {
  sesionDeEntrenamiento: { updateMany: jest.Mock; create: jest.Mock };
  registroDeProgreso: { create: jest.Mock };
  asignacionDeEjercicio: { findFirst: jest.Mock; updateMany: jest.Mock; create: jest.Mock };
  ejercicioMaquina: { findMany: jest.Mock };
}

export interface PrismaFalso {
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

/** Módulo `@/lib/db` mockeado. Se usa desde `jest.mock("@/lib/db", …)`. */
export function crearModuloDb() {
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
  const tx: TxFalso = {
    sesionDeEntrenamiento: prisma.sesionDeEntrenamiento,
    registroDeProgreso: prisma.registroDeProgreso,
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
  (prisma as unknown as { __tx: TxFalso }).__tx = tx;
  return { prisma };
}

export async function mocks(): Promise<PrismaFalso> {
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as PrismaFalso;
}

/** Rutina activa de dos ejercicios; E1 es el primero por orden. */
export function asignacion() {
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

/** Estado base de todos los dobles. Cada test pisa lo que necesita. */
export function configurarDobles(prisma: PrismaFalso): void {
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
}
