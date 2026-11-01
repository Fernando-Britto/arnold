import { AsignacionRepository, type AsignacionDb } from "@/domains/asignacion/asignacion-repositorio";


export const AHORA = new Date("2026-10-26T10:00:00.000Z");

export interface DbFalso {
  asignacionDeEjercicio: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  rutinaAsignada: { findFirst: jest.Mock; findMany: jest.Mock };
  sesionDeEntrenamiento: { findFirst: jest.Mock; findMany: jest.Mock };
  registroDeProgreso: { findMany: jest.Mock };
  ejercicioMaquina: { findMany: jest.Mock };
  maquina: { findMany: jest.Mock };
  socio: { findUnique: jest.Mock };
  configuracionDelSistema: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

export function crearDb(): DbFalso {
  const db: DbFalso = {
    asignacionDeEjercicio: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: "a-1" }),
    },
    rutinaAsignada: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    sesionDeEntrenamiento: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    registroDeProgreso: { findMany: jest.fn().mockResolvedValue([]) },
    ejercicioMaquina: { findMany: jest.fn().mockResolvedValue([]) },
    maquina: { findMany: jest.fn().mockResolvedValue([]) },
    socio: { findUnique: jest.fn().mockResolvedValue(null) },
    configuracionDelSistema: {
      findFirst: jest.fn().mockResolvedValue({ segundosEjecucionSerie: 60, minutosVencimientoReserva: 15, minutosInactividadSesion: 30 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: DbFalso) => unknown) => fn(db));
  return db;
}

export function repo(db: DbFalso): AsignacionRepository {
  return new AsignacionRepository(() => Promise.resolve(db as unknown as AsignacionDb));
}

/** Rutina activa con dos ejercicios, tal como la devuelve Prisma con el `select` del repositorio. */
export const rutinaActiva = {
  id: "ra-1",
  rutina: {
    ejercicios: [
      {
        ejercicioId: "E1",
        series: 2,
        descanso: 90,
        orden: 1,
        ejercicio: { nombre: "Sentadilla" },
      },
      {
        ejercicioId: "E2",
        series: 1,
        descanso: 60,
        orden: 2,
        ejercicio: { nombre: "Press banca" },
      },
    ],
  },
};

/** Rutina con E1 de una sola serie: sirve para probar el filtro de series de trabajo. */
export const rutinaConE1DeUnaSerie = {
  id: "ra-1",
  rutina: {
    ejercicios: [
      { ejercicioId: "E1", series: 1, descanso: 90, orden: 1, ejercicio: { nombre: "Sentadilla" } },
      { ejercicioId: "E2", series: 1, descanso: 60, orden: 2, ejercicio: { nombre: "Press banca" } },
    ],
  },
};

/** Rutina con E1 de tres series: sirve para probar las series fuera de rango. */
export const rutinaConE1DeTresSeries = {
  id: "ra-1",
  rutina: {
    ejercicios: [
      { ejercicioId: "E1", series: 3, descanso: 90, orden: 1, ejercicio: { nombre: "Sentadilla" } },
    ],
  },
};

export const lectura = {
  socioId: "socio-1",
  ahora: AHORA,
  minutosInactividadSesion: 30,
  excluirEjercicioIds: [] as string[],
};

