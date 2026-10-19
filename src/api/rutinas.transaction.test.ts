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
      findMany: jest.fn(async ({ where }: { where: { rutinaId: string } }) =>
        store.ejercicios.filter((e) => e.rutinaId === where.rutinaId)
      ),
      deleteMany: jest.fn(
        async ({ where }: { where: { rutinaId: string; ejercicioId?: { in: string[] } } }) => {
          const antes = store.ejercicios.length;
          store.ejercicios = store.ejercicios.filter(
            (e) =>
              !(
                e.rutinaId === where.rutinaId &&
                (!where.ejercicioId || where.ejercicioId.in.includes(e.ejercicioId as string))
              )
          );
          return { count: antes - store.ejercicios.length };
        }
      ),
      // Igual que Prisma: `@updatedAt` se renueva salvo que quien llama fije el valor (D-61).
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { rutinaId_ejercicioId: { rutinaId: string; ejercicioId: string } };
          data: Record<string, unknown>;
        }) => {
          const { rutinaId, ejercicioId } = where.rutinaId_ejercicioId;
          const fila = store.ejercicios.find(
            (e) => e.rutinaId === rutinaId && e.ejercicioId === ejercicioId
          );
          if (!fila) throw new Error("fila inexistente");
          Object.assign(fila, data, { updatedAt: data.updatedAt ?? new Date("2026-10-17T12:00:00.000Z") });
          return fila;
        }
      ),
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
    // D-61: sin filas previas no hay nada que borrar; solo se crean las nuevas.
    expect(prisma.ejercicioEnRutina.deleteMany).not.toHaveBeenCalled();
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

    expect(prisma.ejercicioEnRutina.findMany).not.toHaveBeenCalled();
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

describe("handleRutinaUpdate — guarda solo lo que cambió (P-43, D-61)", () => {
  /** Cuándo se fijó el plan de las filas sembradas; el motor de progresión lo lee (D-59). */
  const T0 = new Date("2026-10-01T12:00:00.000Z");

  beforeEach(async () => {
    jest.clearAllMocks();
    const prisma = await mocks();
    prisma.__store.rutinas.length = 0;
    prisma.__store.ejercicios.length = 0;
    prisma.__store.rutinas.push({
      id: "rut-1",
      nombre: "Rutina Vieja",
      objetivoPrincipal: "General",
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "BASICO",
      descripcion: null,
    });
    // Las mismas dos filas que `ejercicios`: guardar esa lista no cambia nada.
    prisma.__store.ejercicios.push(
      { rutinaId: "rut-1", ejercicioId: "ej-1", series: 3, repeticiones: 10, descanso: 60, orden: 0, updatedAt: T0 },
      { rutinaId: "rut-1", ejercicioId: "ej-2", series: 4, repeticiones: 8, descanso: 90, orden: 1, updatedAt: T0 }
    );
  });

  function guardar(lista: EjercicioEnRutinaInput[], nombre = "Rutina Vieja") {
    return handleRutinaUpdate("rut-1", {
      nombre,
      frecuenciaSemanal: 3,
      duracionEstimada: 60,
      nivelDeDificultad: "BASICO",
      objetivoPrincipal: "General",
      ejercicios: lista,
    });
  }

  const fila = (prisma: { __store: { ejercicios: Record<string, unknown>[] } }, id: string) =>
    prisma.__store.ejercicios.find((e) => e.ejercicioId === id);

  it("guardar la misma lista (por ejemplo, solo cambió el nombre) no escribe ninguna fila", async () => {
    const prisma = await mocks();

    await guardar(ejercicios, "Rutina Renombrada");

    expect(prisma.ejercicioEnRutina.update).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.createMany).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.deleteMany).not.toHaveBeenCalled();
    expect(prisma.__store.rutinas[0]?.nombre).toBe("Rutina Renombrada");
    expect(fila(prisma, "ej-1")?.updatedAt).toEqual(T0);
    expect(fila(prisma, "ej-2")?.updatedAt).toEqual(T0);
  });

  it.each([
    ["las series", { series: 4 }],
    ["las repeticiones", { repeticiones: 12 }],
  ])("si cambian %s, actualiza solo esa fila y renueva su updatedAt", async (_n, cambio) => {
    const prisma = await mocks();

    await guardar([{ ...ejercicios[0], ...cambio }, ejercicios[1]]);

    expect(prisma.ejercicioEnRutina.update).toHaveBeenCalledTimes(1);
    const llamada = (prisma.ejercicioEnRutina.update as jest.Mock).mock.calls[0][0];
    expect(llamada.where).toEqual({ rutinaId_ejercicioId: { rutinaId: "rut-1", ejercicioId: "ej-1" } });
    // El plan cambió: updatedAt se renueva solo (no se fija), y el motor retoma desde ahí.
    expect(llamada.data).not.toHaveProperty("updatedAt");
    expect(fila(prisma, "ej-1")?.updatedAt).not.toEqual(T0);
    expect(fila(prisma, "ej-2")?.updatedAt).toEqual(T0);
  });

  it("si cambian solo el descanso o el orden, conserva updatedAt: el plan no cambió", async () => {
    const prisma = await mocks();

    // ej-1 pasa al segundo lugar y con descanso 0 (valor legítimo, no se reemplaza por 60).
    await guardar([
      { ...ejercicios[1], orden: 0 },
      { ...ejercicios[0], descanso: 0, orden: 1 },
    ]);

    expect(prisma.ejercicioEnRutina.update).toHaveBeenCalledTimes(2);
    for (const [llamada] of (prisma.ejercicioEnRutina.update as jest.Mock).mock.calls) {
      expect(llamada.data.updatedAt).toEqual(T0);
    }
    expect(fila(prisma, "ej-1")).toMatchObject({ descanso: 0, orden: 1, updatedAt: T0 });
    expect(fila(prisma, "ej-2")).toMatchObject({ descanso: 90, orden: 0, updatedAt: T0 });
  });

  it("los valores numéricos que llegan como texto no cuentan como cambio", async () => {
    const prisma = await mocks();

    await guardar([
      { ejercicioId: "ej-1", series: "3" as unknown as number, repeticiones: "10" as unknown as number, descanso: 60, orden: 0 },
      ejercicios[1],
    ]);

    expect(prisma.ejercicioEnRutina.update).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.createMany).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.deleteMany).not.toHaveBeenCalled();
  });

  it("al agregar un ejercicio crea solo ese y no toca los demás", async () => {
    const prisma = await mocks();
    const nuevo = { ejercicioId: "ej-3", series: 3, repeticiones: 12, descanso: 45, orden: 2 };

    await guardar([...ejercicios, nuevo]);

    expect(prisma.ejercicioEnRutina.createMany).toHaveBeenCalledTimes(1);
    expect((prisma.ejercicioEnRutina.createMany as jest.Mock).mock.calls[0][0].data).toEqual([
      { rutinaId: "rut-1", ...nuevo },
    ]);
    expect(prisma.ejercicioEnRutina.update).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.deleteMany).not.toHaveBeenCalled();
    expect(fila(prisma, "ej-1")?.updatedAt).toEqual(T0);
  });

  it("al quitar un ejercicio borra solo ese", async () => {
    const prisma = await mocks();

    await guardar([ejercicios[0]]);

    expect(prisma.ejercicioEnRutina.deleteMany).toHaveBeenCalledWith({
      where: { rutinaId: "rut-1", ejercicioId: { in: ["ej-2"] } },
    });
    expect(prisma.__store.ejercicios).toHaveLength(1);
    expect(fila(prisma, "ej-1")?.updatedAt).toEqual(T0);
  });

  it("una lista vacía borra todos los ejercicios (NF-1)", async () => {
    const prisma = await mocks();

    await guardar([]);

    expect(prisma.ejercicioEnRutina.deleteMany).toHaveBeenCalledWith({
      where: { rutinaId: "rut-1", ejercicioId: { in: ["ej-1", "ej-2"] } },
    });
    expect(prisma.ejercicioEnRutina.createMany).not.toHaveBeenCalled();
    expect(prisma.__store.ejercicios).toHaveLength(0);
  });

  it("un ejercicio repetido en la lista es DUPLICATE_EXERCISE y no deja nada a medias", async () => {
    const prisma = await mocks();

    await expect(guardar([ejercicios[0], { ...ejercicios[0], orden: 1 }], "Cambiado")).rejects.toMatchObject({
      code: "DUPLICATE_EXERCISE",
    });

    expect(prisma.ejercicioEnRutina.update).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.createMany).not.toHaveBeenCalled();
    expect(prisma.ejercicioEnRutina.deleteMany).not.toHaveBeenCalled();
    expect(prisma.__store.rutinas[0]?.nombre).toBe("Rutina Vieja");
  });
});
