/**
 * Gancho de check-in → cálculo de asignación (T-056g1, CP4c).
 *
 * `evaluarYRegistrarAcceso` corre contra un doble de Prisma propio (el de `acceso.test.ts`
 * no se toca) y la orquestación va mockeada: acá se prueba el disparo, no el motor.
 */
import { evaluarYRegistrarAcceso, type EvaluarAccesoInput, type SocioParaAcceso } from "./acceso";
import { calcularEnCheckIn } from "@/domains/asignacion/orquestacion";
import type { PrismaLike } from "./acceso";

jest.mock("@/domains/asignacion/orquestacion");

const mockCalcular = calcularEnCheckIn as jest.MockedFunction<typeof calcularEnCheckIn>;

const AHORA = new Date("2026-10-25T10:00:00.000Z");

interface Store {
  asistencias: unknown[];
  auditorias: unknown[];
}

interface PrismaFalso {
  cuota: { findFirst: jest.Mock };
  configuracionDelSistema: { findFirst: jest.Mock };
  asistencia: { findFirst: jest.Mock; create: jest.Mock };
  auditoriaAcceso: { create: jest.Mock };
  $transaction: jest.Mock;
  __store: Store;
}

function crearPrisma(opciones: { asistenciaReciente?: boolean } = {}): PrismaFalso {
  const store: Store = { asistencias: [], auditorias: [] };

  const prisma: PrismaFalso = {
    cuota: {
      findFirst: jest.fn(async () => ({ fechaVencimiento: new Date("2026-10-31T00:00:00.000Z") })),
    },
    configuracionDelSistema: { findFirst: jest.fn(async () => null) },
    asistencia: {
      findFirst: jest.fn(async () => (opciones.asistenciaReciente ? { id: "a-previa" } : null)),
      create: jest.fn(async ({ data }: { data: unknown }) => {
        store.asistencias.push(data);
        return data;
      }),
    },
    auditoriaAcceso: {
      create: jest.fn(async ({ data }: { data: unknown }) => {
        store.auditorias.push(data);
        return data;
      }),
    },
    $transaction: jest.fn(),
    __store: store,
  };

  prisma.$transaction.mockImplementation(async (callback: (tx: PrismaFalso) => Promise<unknown>) =>
    callback(prisma)
  );
  return prisma;
}

function socio(overrides: Partial<SocioParaAcceso> = {}): SocioParaAcceso {
  return {
    id: "socio-1",
    estadoCuota: "AL_DIA",
    usuario: { nombre: "Ana" },
    membresiaAsignada: { nombre: "Mensual" },
    ...overrides,
  };
}

const ENTRADA: EvaluarAccesoInput = {
  ip: "127.0.0.1",
  userAgent: "jest",
  metodo: "DNI_PIN",
  ahora: AHORA,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCalcular.mockResolvedValue(undefined);
});

describe("gancho de check-in: disparo permitido", () => {
  it("un check-in permitido dispara el cálculo una vez con el mismo ahora", async () => {
    const prisma = crearPrisma();

    await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), ENTRADA);

    expect(mockCalcular).toHaveBeenCalledTimes(1);
    expect(mockCalcular).toHaveBeenCalledWith({ socioId: "socio-1", ahora: AHORA });
  });

  it("el gancho usa el mismo ahora de la asistencia", async () => {
    const prisma = crearPrisma();

    await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), ENTRADA);

    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fechaHora: AHORA }),
    });
    expect(mockCalcular).toHaveBeenCalledWith({ socioId: "socio-1", ahora: AHORA });
  });

  it("evaluarYRegistrarAcceso dispara el cálculo una sola vez", async () => {
    const prisma = crearPrisma();

    await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), ENTRADA);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockCalcular).toHaveBeenCalledTimes(1);
  });

  it("el gancho no agrega campos a CheckInResultado", async () => {
    const prisma = crearPrisma();

    const resultado = await evaluarYRegistrarAcceso(
      prisma as unknown as PrismaLike,
      socio(),
      ENTRADA
    );

    expect(resultado).toEqual({
      resultado: "PERMITIDO",
      socio: { id: "socio-1", nombre: "Ana", membresia: "Mensual" },
      estadoCuota: "AL_DIA",
    });
  });
});

describe("gancho de check-in: best-effort y denegados", () => {
  it("si el motor lanza, la asistencia queda registrada y la respuesta no cambia", async () => {
    const prisma = crearPrisma();
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCalcular.mockRejectedValue(new Error("motor roto"));

    const resultado = await evaluarYRegistrarAcceso(
      prisma as unknown as PrismaLike,
      socio(),
      ENTRADA
    );

    expect(resultado).toEqual({
      resultado: "PERMITIDO",
      socio: { id: "socio-1", nombre: "Ana", membresia: "Mensual" },
      estadoCuota: "AL_DIA",
    });
    expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "[ASIGNACION][check-in]",
      expect.objectContaining({ socioId: "socio-1", tipo: "error-no-contenido" })
    );
    log.mockRestore();
  });

  it("si la persistencia de la reserva falla, no queda nada parcial y la respuesta no cambia", async () => {
    const prisma = crearPrisma();
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCalcular.mockRejectedValue(new Error("persistencia caída"));

    const resultado = await evaluarYRegistrarAcceso(
      prisma as unknown as PrismaLike,
      socio(),
      ENTRADA
    );

    expect(resultado.resultado).toBe("PERMITIDO");
    expect(prisma.__store.asistencias).toHaveLength(1);
    expect(prisma.__store.auditorias).toHaveLength(1);
    log.mockRestore();
  });

  it("un check-in denegado no dispara el cálculo", async () => {
    const prisma = crearPrisma();

    const resultado = await evaluarYRegistrarAcceso(
      prisma as unknown as PrismaLike,
      socio({ estadoCuota: "INACTIVA" }),
      ENTRADA
    );

    expect(resultado.resultado).toBe("DENEGADO");
    expect(mockCalcular).not.toHaveBeenCalled();
  });

  it("un check-in denegado por anti-passback no dispara", async () => {
    const prisma = crearPrisma({ asistenciaReciente: true });

    const resultado = await evaluarYRegistrarAcceso(
      prisma as unknown as PrismaLike,
      socio(),
      ENTRADA
    );

    expect(resultado.resultado).toBe("DENEGADO");
    expect(mockCalcular).not.toHaveBeenCalled();
  });

  it("el log del gancho no incluye DNI ni PIN", async () => {
    const prisma = crearPrisma();
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCalcular.mockRejectedValue(new Error("motor roto"));

    await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), ENTRADA);

    const [, payload] = log.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(payload).sort()).toEqual(["error", "socioId", "tipo"]);
    expect(JSON.stringify(payload)).not.toMatch(/dni|pin/i);
    log.mockRestore();
  });

  it("registra exactamente una Asistencia y una AuditoriaAcceso por intento", async () => {
    const prisma = crearPrisma();

    await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), ENTRADA);
    await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), ENTRADA);

    expect(prisma.asistencia.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledTimes(2);
    expect(prisma.__store.asistencias).toHaveLength(2);
    expect(prisma.__store.auditorias).toHaveLength(2);
  });
});
