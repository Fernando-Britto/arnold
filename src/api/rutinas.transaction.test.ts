/**
 * NF-2 — Atomicidad de las escrituras acopladas de Rutina + EjercicioEnRutina.
 *
 * `handleRutinaCreate` y `handleRutinaUpdate` deben ejecutar la escritura de la rutina
 * y la sincronización de ejercicios dentro de UNA sola `prisma.$transaction`. Si la
 * segunda escritura falla, la primera no debe persistir.
 *
 * Prisma va mockeado: el motor remoto no es alcanzable. El mock de `$transaction`
 * implementa rollback sobre un store en memoria para probar la atomicidad.
 */
import { handleRutinaCreate, handleRutinaUpdate } from "./rutinas";
import type { EjercicioEnRutinaInput } from "./rutinas";

jest.mock("@/lib/db", () => {
  const store = { rutinas: [] as Record<string, unknown>[], ejercicios: [] as Record<string, unknown>[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    rutina: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return store.rutinas.find((r) => r.id === where.id) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const creada = { id: "rut-1", ...data };
        store.rutinas.push(creada);
        return creada;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const rutina = store.rutinas.find((r) => r.id === where.id);
        if (!rutina) return null;
        Object.assign(rutina, data);
        return rutina;
      }),
    },
    ejercicioEnRutina: {
      deleteMany: jest.fn(async ({ where }: { where: { rutinaId: string } }) => {
        store.ejercicios = store.ejercicios.filter((e) => e.rutinaId !== where.rutinaId);
        return { count: 0 };
      }),
      createMany: jest.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        store.ejercicios.push(...data);
        return { count: data.length };
      }),
    },
  };
  prisma.$transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    const snapshot = JSON.parse(JSON.stringify(store));
    try {
      return await callback(prisma);
    } catch (error) {
      store.rutinas = snapshot.rutinas;
      store.ejercicios = snapshot.ejercicios;
      throw error;
    }
  });
  prisma.__store = store;
  return { prisma };
});

async function mocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: any };
  return prisma;
}

const ejercicios: EjercicioEnRutinaInput[] = [
  { ejercicioId: "ej-1", series: 3, repeticiones: 10, descanso: 60, orden: 0 },
  { ejercicioId: "ej-2", series: 4, repeticiones: 8, descanso: 90, orden: 1 },
];

const rutinaInput = {
  nombre: "Rutina Full Body",
  objetivoPrincipal: "Fuerza",
  frecuenciaSemanal: 3,
  duracionEstimada: 60,
  nivelDeDificultad: "BASICO",
};

describe("handleRutinaCreate — atomicidad (rutina + ejercicios en UNA transacción)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const prisma = await mocks();
    prisma.__store.rutinas.length = 0;
    prisma.__store.ejercicios.length = 0;
  });

  it("crea la rutina y sus ejercicios dentro de una sola transacción", async () => {
    const prisma = await mocks();

    await handleRutinaCreate({ ...rutinaInput, ejercicios });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.ejercicioEnRutina.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.__store.rutinas).toHaveLength(1);
    expect(prisma.__store.ejercicios).toHaveLength(2);
  });

  it("si falla la creación de ejercicios, NO persiste la rutina", async () => {
    const prisma = await mocks();
    (prisma.ejercicioEnRutina.createMany as jest.Mock).mockRejectedValueOnce(
      new Error("boom-ejercicios")
    );

    await expect(
      handleRutinaCreate({ ...rutinaInput, ejercicios })
    ).rejects.toThrow("boom-ejercicios");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.__store.rutinas).toHaveLength(0);
    expect(prisma.__store.ejercicios).toHaveLength(0);
  });

  it("sin ejercicios igual persiste la rutina en una sola transacción", async () => {
    const prisma = await mocks();

    await handleRutinaCreate({ ...rutinaInput });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.ejercicioEnRutina.createMany).not.toHaveBeenCalled();
    expect(prisma.__store.rutinas).toHaveLength(1);
  });

  // NF-3: descanso 0 es un valor legítimo; no debe reemplazarse por 60.
  it("preserva descanso 0 al crear (no lo reemplaza por 60)", async () => {
    const prisma = await mocks();

    await handleRutinaCreate({
      ...rutinaInput,
      ejercicios: [{ ejercicioId: "ej-0", series: 3, repeticiones: 10, descanso: 0, orden: 0 }],
    });

    expect(prisma.__store.ejercicios[0]?.descanso).toBe(0);
  });
});

describe("handleRutinaUpdate — atomicidad (update + delete + create en UNA transacción)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const prisma = await mocks();
    prisma.__store.rutinas.length = 0;
    prisma.__store.ejercicios.length = 0;
  });

  async function seedRutina() {
    const prisma = await mocks();
    prisma.__store.rutinas.push({
      id: "rut-1",
      nombre: "Rutina Vieja",
      objetivoPrincipal: "General",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "BASICO",
      descripcion: null,
    });
    return prisma;
  }

  it("actualiza la rutina y sincroniza ejercicios dentro de una sola transacción", async () => {
    const prisma = await seedRutina();

    await handleRutinaUpdate("rut-1", {
      nombre: "Rutina Nueva",
      frecuenciaSemanal: 4,
      duracionEstimada: 75,
      nivelDeDificultad: "AVANZADO",
      objetivoPrincipal: "Hipertrofia",
      ejercicios,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.ejercicioEnRutina.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.ejercicioEnRutina.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.__store.ejercicios).toHaveLength(2);
    expect(prisma.__store.rutinas[0]?.nombre).toBe("Rutina Nueva");
  });

  // NF-3: descanso 0 es un valor legítimo; no debe reemplazarse por 60.
  it("preserva descanso 0 al actualizar (no lo reemplaza por 60)", async () => {
    const prisma = await seedRutina();

    await handleRutinaUpdate("rut-1", {
      nombre: "Rutina Nueva",
      frecuenciaSemanal: 4,
      duracionEstimada: 75,
      nivelDeDificultad: "AVANZADO",
      objetivoPrincipal: "Hipertrofia",
      ejercicios: [{ ejercicioId: "ej-0", series: 3, repeticiones: 10, descanso: 0, orden: 0 }],
    });

    expect(prisma.__store.ejercicios[0]?.descanso).toBe(0);
  });

  it("si falla la creación de ejercicios, revierte el update de la rutina", async () => {
    const prisma = await seedRutina();
    (prisma.ejercicioEnRutina.createMany as jest.Mock).mockRejectedValueOnce(
      new Error("boom-ejercicios")
    );

    await expect(
      handleRutinaUpdate("rut-1", {
        nombre: "Rutina Nueva",
        frecuenciaSemanal: 4,
        duracionEstimada: 75,
        nivelDeDificultad: "AVANZADO",
        objetivoPrincipal: "Hipertrofia",
        ejercicios,
      })
    ).rejects.toThrow("boom-ejercicios");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.__store.rutinas[0]?.nombre).toBe("Rutina Vieja");
    expect(prisma.__store.ejercicios).toHaveLength(0);
  });

  it("`ejercicios === undefined` deja la subsección intacta", async () => {
    const prisma = await seedRutina();
    prisma.__store.ejercicios.push({ rutinaId: "rut-1", ejercicioId: "ej-9" });

    await handleRutinaUpdate("rut-1", {
      nombre: "Rutina Nueva",
      frecuenciaSemanal: 4,
      duracionEstimada: 75,
      nivelDeDificultad: "AVANZADO",
      objetivoPrincipal: "Hipertrofia",
    });

    expect(prisma.ejercicioEnRutina.deleteMany).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.createMany).not.toHaveBeenCalled();
    expect(prisma.__store.ejercicios).toHaveLength(1);
  });

  it("devuelve null si la rutina no existe", async () => {
    const prisma = await mocks();

    const resultado = await handleRutinaUpdate("nope", { nombre: "X", ejercicios });

    expect(resultado).toBeNull();
    expect(prisma.ejercicioEnRutina.deleteMany).not.toHaveBeenCalled();
  });
});
