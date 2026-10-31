/**
 * Check-in fuera de la ventana anti-passback (AC-453 / AC-525).
 *
 * `evaluarYRegistrarAcceso` corre contra un doble de Prisma propio: la asistencia previa se busca
 * con el mismo filtro que la consulta real (`estado: PERMITIDO` + `fechaHora >= desde`), así que la
 * ventana se ejercita de verdad. La orquestación va mockeada: acá se prueba el disparo del gancho.
 */
import { evaluarYRegistrarAcceso, type EvaluarAccesoInput, type SocioParaAcceso } from "./acceso";
import type { PrismaLike } from "./acceso";
import { calcularEnCheckIn } from "@/domains/asignacion/orquestacion";

jest.mock("@/domains/asignacion/orquestacion");

const mockCalcular = calcularEnCheckIn as jest.MockedFunction<typeof calcularEnCheckIn>;

const T0 = new Date("2026-10-25T10:00:00.000Z");
const minutos = (n: number) => new Date(T0.getTime() + n * 60_000);

interface Asistencia {
  socioId: string;
  estado: string;
  fechaHora: Date;
}

function crearPrisma() {
  const asistencias: Asistencia[] = [];

  const prisma = {
    cuota: {
      findFirst: jest.fn(async () => ({ fechaVencimiento: new Date("2026-10-31T00:00:00.000Z") })),
    },
    configuracionDelSistema: { findFirst: jest.fn(async () => null) },
    asistencia: {
      findFirst: jest.fn(
        async (args: { where: { socioId: string; estado: string; fechaHora: { gte: Date } } }) => {
          const { socioId, estado, fechaHora } = args.where;
          const previa = asistencias.find(
            (a) =>
              a.socioId === socioId && a.estado === estado && a.fechaHora.getTime() >= fechaHora.gte.getTime()
          );
          return previa ?? null;
        }
      ),
      create: jest.fn(async ({ data }: { data: Asistencia }) => {
        asistencias.push(data);
        return data;
      }),
    },
    auditoriaAcceso: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(prisma)
  );
  return prisma;
}

function socio(): SocioParaAcceso {
  return {
    id: "socio-1",
    estadoCuota: "AL_DIA",
    usuario: { nombre: "Ana" },
    membresiaAsignada: null,
  };
}

const entrada = (ahora: Date): EvaluarAccesoInput => ({
  ip: "127.0.0.1",
  userAgent: "jest",
  metodo: "DNI_PIN",
  ahora,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCalcular.mockResolvedValue(undefined);
});

describe("check-in y ventana anti-passback", () => {
  it("fuera de la ventana, el segundo check-in es permitido y vuelve a disparar el cálculo", async () => {
    const prisma = crearPrisma();

    const primero = await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), entrada(T0));
    // La ventana por defecto es de 60 minutos: 61 queda afuera.
    const segundo = await evaluarYRegistrarAcceso(
      prisma as unknown as PrismaLike,
      socio(),
      entrada(minutos(61))
    );

    expect(primero.resultado).toBe("PERMITIDO");
    expect(segundo.resultado).toBe("PERMITIDO");
    expect(mockCalcular).toHaveBeenCalledTimes(2);
    // Se asertan los inputs exactos; el segundo argumento (timeouts de D-110) tiene sus propios tests.
    expect(mockCalcular.mock.calls.map(([input]) => input)).toEqual([
      { socioId: "socio-1", ahora: T0 },
      { socioId: "socio-1", ahora: minutos(61) },
    ]);
  });

  it("dentro de la ventana, el segundo check-in es denegado y no dispara el cálculo", async () => {
    const prisma = crearPrisma();

    await evaluarYRegistrarAcceso(prisma as unknown as PrismaLike, socio(), entrada(T0));
    const segundo = await evaluarYRegistrarAcceso(
      prisma as unknown as PrismaLike,
      socio(),
      entrada(minutos(30))
    );

    expect(segundo.resultado).toBe("DENEGADO");
    expect(mockCalcular).toHaveBeenCalledTimes(1);
  });
});
