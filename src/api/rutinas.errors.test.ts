/**
 * NF-6 — Borrar una rutina con asignaciones históricas (referenciadas por
 * `SesionDeEntrenamiento`, FK `onDelete: Restrict`) no debe explotar con un 500.
 * NF-11 — Ejercicios duplicados en una rutina (unique `[rutinaId, ejercicioId]`)
 * no deben explotar con un 500: debe devolverse 409 DUPLICATE_EXERCISE.
 *
 * Prisma va mockeado: el motor remoto no es alcanzable desde este entorno.
 */
import { handleRutinaDelete, handleRutinaCreate } from "./rutinas";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    rutina: {
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "rut-1",
        ...data,
      })),
      delete: jest.fn(),
    },
    rutinaAsignada: { count: jest.fn() },
    ejercicioEnRutina: { createMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((ops: unknown) =>
    typeof ops === "function"
      ? (ops as (tx: unknown) => unknown)(prisma)
      : Promise.all((ops as unknown[]).map(() => ({})))
  );
  return { prisma };
});

async function mocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: any };
  return prisma;
}

describe("handleRutinaDelete — NF-6 (historial de sesiones, nunca 500)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("bloquea el borrado cuando hay asignaciones inactivas con sesiones históricas", async () => {
    const prisma = await mocks();
    prisma.rutina.findUnique.mockResolvedValue({ id: "rut-1" });
    // 1ª consulta: asignaciones activas = 0. 2ª consulta: asignaciones con sesiones = 1.
    prisma.rutinaAsignada.count.mockImplementation(
      ({ where }: { where: { sesiones?: unknown } }) =>
        Promise.resolve(where.sesiones ? 1 : 0)
    );
    prisma.rutina.delete.mockResolvedValue({ id: "rut-1" });

    const error = await handleRutinaDelete("rut-1").catch((e) => e);

    expect((error as Error).message).toContain("DELETE_BLOCKED_ASSIGNED");
    expect(prisma.rutina.delete).not.toHaveBeenCalled();
    expect(mapErrorToResponse(error, { resourceName: "Rutina" }).status).toBe(409);
  });

  it("mapea P2003 del delete a 409, no a un 500 (red de seguridad)", async () => {
    const prisma = await mocks();
    prisma.rutina.findUnique.mockResolvedValue({ id: "rut-1" });
    prisma.rutinaAsignada.count.mockResolvedValue(0);
    prisma.rutina.delete.mockRejectedValue(
      Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" })
    );

    const error = await handleRutinaDelete("rut-1").catch((e) => e);

    expect((error as Error).message).toContain("DELETE_BLOCKED_ASSIGNED");
    expect(mapErrorToResponse(error, { resourceName: "Rutina" }).status).toBe(409);
  });
});

describe("handleRutinaCreate — NF-11 (ejercicio duplicado, nunca 500)", () => {
  beforeEach(() => jest.clearAllMocks());

  const rutinaInput = {
    nombre: "Rutina Full Body",
    objetivoPrincipal: "Fuerza",
    frecuenciaSemanal: 3,
    duracionEstimada: 60,
    nivelDeDificultad: "BASICO",
  };
  const ejerciciosDuplicados = [
    { ejercicioId: "ej-1", series: 3, repeticiones: 10, descanso: 60, orden: 0 },
    { ejercicioId: "ej-1", series: 4, repeticiones: 8, descanso: 90, orden: 1 },
  ];

  it("traduce el P2002 de la unique [rutinaId, ejercicioId] a 409 DUPLICATE_EXERCISE", async () => {
    const prisma = await mocks();
    prisma.ejercicioEnRutina.createMany.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["rutinaId", "ejercicioId"] },
      })
    );

    const error = await handleRutinaCreate({
      ...rutinaInput,
      ejercicios: ejerciciosDuplicados,
    }).catch((e) => e);

    expect((error as Error).message).toContain("DUPLICATE_EXERCISE");
    const mapped = mapErrorToResponse(error, { resourceName: "Rutina" });
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe("DUPLICATE_EXERCISE");
    expect(mapped.message).toMatch(/El ejercicio ya está en la rutina/);
  });
});
