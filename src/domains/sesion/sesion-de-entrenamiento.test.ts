/**
 * Sesión de entrenamiento (T-037, D-44/D-48): iniciar, registrar serie, finalizar y última carga.
 * Spec: openspec/specs/home-socio-portal/spec.md (Tarjeta_Rutina / sesión en curso).
 *
 * Prisma va mockeado: el motor remoto no es alcanzable. `$transaction(callback)` recibe el mismo
 * mock como `tx` (igual que registrar-pago.test.ts / asignar-rutina.test.ts).
 */
import {
  iniciarSesion,
  obtenerSesionEnCurso,
  registrarSerie,
  finalizarSesion,
  ultimaCarga,
  obtenerSesion,
  detalleSesionEnCurso,
} from "./sesion-de-entrenamiento";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    socio: { findUnique: jest.fn() },
    rutinaAsignada: { findUnique: jest.fn() },
    sesionDeEntrenamiento: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    registroDeProgreso: { create: jest.fn(), findFirst: jest.fn() },
  };
  prisma.$transaction = jest.fn((ops) =>
    typeof ops === "function" ? Promise.resolve(ops(prisma)) : Promise.all(ops.map(() => ({})))
  );
  return { prisma };
});

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

/** Asignación activa con una rutina de 2 ejercicios: ej-1 (2 series) y ej-2 (1 serie). */
function asignacionActiva(overrides: Record<string, unknown> = {}) {
  return {
    id: "asig-1",
    socioId: "socio-1",
    activa: true,
    rutina: {
      ejercicios: [
        {
          id: "er-1",
          ejercicioId: "ej-1",
          series: 2,
          repeticiones: 10,
          descanso: 60,
          orden: 0,
          ejercicio: { id: "ej-1", nombre: "Press banca" },
        },
        {
          id: "er-2",
          ejercicioId: "ej-2",
          series: 1,
          repeticiones: 8,
          descanso: 90,
          orden: 1,
          ejercicio: { id: "ej-2", nombre: "Sentadilla" },
        },
      ],
    },
    ...overrides,
  };
}

/** Sesión EN_CURSO lista para registrar serie, con la rutina incluida. */
function sesionEnCurso(overrides: Record<string, unknown> = {}) {
  return {
    id: "sesion-1",
    socioId: "socio-1",
    estadoDeFinalizacion: "EN_CURSO",
    horaInicio: new Date("2026-10-12T13:00:00.000Z"),
    horaFin: null,
    ejercicioActualId: "ej-1",
    serieActual: 1,
    rutinaAsignada: asignacionActiva(),
    ...overrides,
  };
}

describe("iniciarSesion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crea la sesión EN_CURSO con el primer ejercicio (por orden) y la serie 1", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(asignacionActiva());
    const creada = {
      id: "sesion-1",
      socioId: "socio-1",
      rutinaAsignadaId: "asig-1",
      estadoDeFinalizacion: "EN_CURSO",
      ejercicioActualId: "ej-1",
      serieActual: 1,
    };
    (prisma.sesionDeEntrenamiento.create as jest.Mock).mockResolvedValue(creada);

    const ahora = new Date("2026-10-12T13:00:00.000Z");
    const r = await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1", ahora });

    expect(r.sesion).toEqual(creada);
    expect(prisma.sesionDeEntrenamiento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socioId: "socio-1",
        rutinaAsignadaId: "asig-1",
        estadoDeFinalizacion: "EN_CURSO",
        horaInicio: ahora,
        ejercicioActualId: "ej-1",
        serieActual: 1,
      }),
    });
    // Devuelve los ejercicios ordenados con series/repeticiones/descanso.
    expect(r.ejercicios).toEqual([
      { id: "ej-1", nombre: "Press banca", series: 2, repeticiones: 10, descanso: 60, orden: 0 },
      { id: "ej-2", nombre: "Sentadilla", series: 1, repeticiones: 8, descanso: 90, orden: 1 },
    ]);
  });

  it("lanza NOT_FOUND si el socio no existe", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      iniciarSesion({ socioId: "nope", rutinaAsignadaId: "asig-1" })
    ).rejects.toThrow("NOT_FOUND");
    expect(prisma.sesionDeEntrenamiento.create).not.toHaveBeenCalled();
  });

  it("lanza NOT_FOUND si la asignación no existe", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "nope" })
    ).rejects.toThrow("NOT_FOUND");
    expect(prisma.sesionDeEntrenamiento.create).not.toHaveBeenCalled();
  });

  it("lanza error de validación si la asignación no está activa", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(
      asignacionActiva({ activa: false })
    );

    await expect(
      iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1" })
    ).rejects.toThrow(/VALIDATION_ERROR.*activa/i);
    expect(prisma.sesionDeEntrenamiento.create).not.toHaveBeenCalled();
  });

  // SE-1: ABANDONADA tiene que persistirse con un disparador real. Regla elegida: iniciar
  // una sesión cuando ya hay una EN_CURSO deja la anterior en ABANDONADA (con horaFin).
  it("marca ABANDONADA (con horaFin) la sesión EN_CURSO previa del socio", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(asignacionActiva());
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.sesionDeEntrenamiento.create as jest.Mock).mockResolvedValue({
      id: "sesion-2",
      socioId: "socio-1",
      estadoDeFinalizacion: "EN_CURSO",
    });

    const ahora = new Date("2026-10-12T14:00:00.000Z");
    await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1", ahora });

    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
      where: { socioId: "socio-1", estadoDeFinalizacion: "EN_CURSO" },
      data: { estadoDeFinalizacion: "ABANDONADA", horaFin: ahora },
    });
  });

  // SE-3: el abandono de la previa y la creación de la nueva van en UNA transacción,
  // abandonando ANTES de crear (así nunca queda más de una EN_CURSO por socio).
  it("abandona la previa y crea la nueva en UNA transacción, en ese orden", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(asignacionActiva());
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.sesionDeEntrenamiento.create as jest.Mock).mockResolvedValue({ id: "sesion-2" });

    await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1" });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const txOrder = (prisma.$transaction as jest.Mock).mock.invocationCallOrder[0];
    const abandonOrder = (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mock
      .invocationCallOrder[0];
    const createOrder = (prisma.sesionDeEntrenamiento.create as jest.Mock).mock
      .invocationCallOrder[0];
    expect(txOrder).toBeLessThan(abandonOrder);
    expect(abandonOrder).toBeLessThan(createOrder);
  });

  // SE-3 (invariante): tras dos inicios quedan a lo sumo UNA EN_CURSO por socio y la
  // anterior queda ABANDONADA. Emula el estado de la tabla para verificar el invariante.
  it("tras dos inicios, a lo sumo una EN_CURSO por socio y la previa queda ABANDONADA", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(asignacionActiva());

    type Fila = {
      id: string;
      socioId: string;
      estadoDeFinalizacion: string;
      horaInicio: Date;
      horaFin: Date | null;
    };
    const tabla: Fila[] = [];
    (prisma.sesionDeEntrenamiento.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Omit<Fila, "id" | "horaFin"> }) => {
        const fila: Fila = { id: `sesion-${tabla.length + 1}`, horaFin: null, ...data };
        tabla.push(fila);
        return fila;
      }
    );
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockImplementation(
      async ({ where, data }: { where: { socioId: string; estadoDeFinalizacion: string }; data: Partial<Fila> }) => {
        let count = 0;
        for (const fila of tabla) {
          if (
            fila.socioId === where.socioId &&
            fila.estadoDeFinalizacion === where.estadoDeFinalizacion
          ) {
            Object.assign(fila, data);
            count++;
          }
        }
        return { count };
      }
    );

    const primera = new Date("2026-10-12T13:00:00.000Z");
    const segunda = new Date("2026-10-12T14:00:00.000Z");
    await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1", ahora: primera });
    await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1", ahora: segunda });

    const enCurso = tabla.filter((s) => s.estadoDeFinalizacion === "EN_CURSO");
    expect(enCurso).toHaveLength(1);
    expect(enCurso[0].id).toBe("sesion-2");

    const abandonadas = tabla.filter((s) => s.estadoDeFinalizacion === "ABANDONADA");
    expect(abandonadas).toHaveLength(1);
    expect(abandonadas[0].id).toBe("sesion-1");
    expect(abandonadas[0].horaFin).toEqual(segunda);
  });
});

describe("obtenerSesionEnCurso", () => {
  beforeEach(() => jest.clearAllMocks());

  it("busca la sesión EN_CURSO del socio, la más reciente primero", async () => {
    const prisma = await mocks();
    const sesion = { id: "sesion-1", ejercicioActualId: "ej-1", serieActual: 2 };
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue(sesion);

    const r = await obtenerSesionEnCurso("socio-1");

    expect(r).toEqual(sesion);
    expect(prisma.sesionDeEntrenamiento.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1", estadoDeFinalizacion: "EN_CURSO" },
      orderBy: { horaInicio: "desc" },
    });
  });

  it("devuelve null si el socio no tiene sesión en curso", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue(null);

    expect(await obtenerSesionEnCurso("socio-1")).toBeNull();
  });
});

describe("registrarSerie", () => {
  beforeEach(async () => {
    const prisma = await mocks();
    // Reset explícito: `mockClear` no vacía la cola de `mockResolvedValueOnce`.
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockReset();
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockReset();
    (prisma.registroDeProgreso.create as jest.Mock).mockReset();
    // La actualización condicional normalmente encuentra la fila (count = 1).
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it("crea el RegistroDeProgreso con la serie actual y avanza serieActual", async () => {
    const prisma = await mocks();
    const inicial = sesionEnCurso();
    const actualizada = { id: "sesion-1", ejercicioActualId: "ej-1", serieActual: 2 };
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock)
      .mockResolvedValueOnce(inicial)
      .mockResolvedValueOnce(actualizada);
    (prisma.registroDeProgreso.create as jest.Mock).mockResolvedValue({ id: "reg-1" });

    const r = await registrarSerie({
      sesionId: "sesion-1",
      ejercicioId: "ej-1",
      carga: 40,
      repeticiones: 10,
      rir: 2,
    });

    expect(prisma.registroDeProgreso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sesionId: "sesion-1",
        socioId: "socio-1",
        ejercicioId: "ej-1",
        carga: 40,
        repeticiones: 10,
        rir: 2,
        numeroSerie: 1,
      }),
    });
    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
      where: {
        id: "sesion-1",
        estadoDeFinalizacion: "EN_CURSO",
        serieActual: 1,
        ejercicioActualId: "ej-1",
      },
      data: { ejercicioActualId: "ej-1", serieActual: 2 },
    });
    expect(r).toEqual({ registro: { id: "reg-1" }, sesion: actualizada });
  });

  it("al terminar las series del ejercicio avanza al siguiente y vuelve a serie 1", async () => {
    const prisma = await mocks();
    // ej-1 tiene 2 series: esta es la última (serieActual 2).
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock)
      .mockResolvedValueOnce(sesionEnCurso({ serieActual: 2 }))
      .mockResolvedValueOnce({ id: "sesion-1", ejercicioActualId: "ej-2", serieActual: 1 });
    (prisma.registroDeProgreso.create as jest.Mock).mockResolvedValue({ id: "reg-2" });

    await registrarSerie({
      sesionId: "sesion-1",
      ejercicioId: "ej-1",
      carga: 45,
      repeticiones: 8,
      rir: null,
    });

    expect(prisma.registroDeProgreso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ numeroSerie: 2, rir: null }),
    });
    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
      where: {
        id: "sesion-1",
        estadoDeFinalizacion: "EN_CURSO",
        serieActual: 2,
        ejercicioActualId: "ej-1",
      },
      data: { ejercicioActualId: "ej-2", serieActual: 1 },
    });
  });

  it("al terminar la última serie del último ejercicio deja la sesión lista para cerrar", async () => {
    const prisma = await mocks();
    // ej-2 tiene 1 serie y es el último: no hay siguiente.
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock)
      .mockResolvedValueOnce(sesionEnCurso({ ejercicioActualId: "ej-2", serieActual: 1 }))
      .mockResolvedValueOnce({ id: "sesion-1", ejercicioActualId: null, serieActual: null });
    (prisma.registroDeProgreso.create as jest.Mock).mockResolvedValue({ id: "reg-3" });

    await registrarSerie({
      sesionId: "sesion-1",
      ejercicioId: "ej-2",
      carga: 60,
      repeticiones: 8,
      rir: 1,
    });

    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith({
      where: {
        id: "sesion-1",
        estadoDeFinalizacion: "EN_CURSO",
        serieActual: 1,
        ejercicioActualId: "ej-2",
      },
      data: { ejercicioActualId: null, serieActual: null },
    });
  });

  it("usa UNA transacción para leer, crear el registro y actualizar la sesión", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionEnCurso());
    (prisma.registroDeProgreso.create as jest.Mock).mockResolvedValue({ id: "reg-1" });

    await registrarSerie({
      sesionId: "sesion-1",
      ejercicioId: "ej-1",
      carga: 40,
      repeticiones: 10,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("lee y revalida la sesión DENTRO de la transacción (no antes)", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionEnCurso());
    (prisma.registroDeProgreso.create as jest.Mock).mockResolvedValue({ id: "reg-1" });

    await registrarSerie({
      sesionId: "sesion-1",
      ejercicioId: "ej-1",
      carga: 40,
      repeticiones: 10,
    });

    const txOrder = (prisma.$transaction as jest.Mock).mock.invocationCallOrder[0];
    const readOrder = (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mock
      .invocationCallOrder[0];
    expect(txOrder).toBeLessThan(readOrder);
  });

  it("rechaza un doble envío concurrente (serieActual ya avanzada) sin crear el registro", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionEnCurso());
    // Otro request avanzó serieActual entre la lectura y la escritura: el guard no matchea.
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      registrarSerie({ sesionId: "sesion-1", ejercicioId: "ej-1", carga: 40, repeticiones: 10 })
    ).rejects.toThrow(/VALIDATION_ERROR.*concurren/i);
    expect(prisma.registroDeProgreso.create).not.toHaveBeenCalled();
  });

  it("rechaza registrar si la sesión no está EN_CURSO", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(
      sesionEnCurso({ estadoDeFinalizacion: "COMPLETADA" })
    );

    await expect(
      registrarSerie({ sesionId: "sesion-1", ejercicioId: "ej-1", carga: 40, repeticiones: 10 })
    ).rejects.toThrow(/VALIDATION_ERROR.*en curso/i);
    expect(prisma.registroDeProgreso.create).not.toHaveBeenCalled();
  });

  it("rechaza registrar sobre un ejercicio que no es el actual de la sesión", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionEnCurso());

    await expect(
      registrarSerie({ sesionId: "sesion-1", ejercicioId: "ej-2", carga: 40, repeticiones: 10 })
    ).rejects.toThrow(/VALIDATION_ERROR.*actual/i);
    expect(prisma.registroDeProgreso.create).not.toHaveBeenCalled();
  });

  it.each([
    ["carga negativa", { carga: -1, repeticiones: 10 }],
    ["carga no numérica", { carga: "cuarenta" as unknown as number, repeticiones: 10 }],
    ["repeticiones 0", { carga: 40, repeticiones: 0 }],
    ["repeticiones no entera", { carga: 40, repeticiones: 2.5 }],
  ])("rechaza %s", async (_caso, overrides) => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionEnCurso());

    await expect(
      registrarSerie({ sesionId: "sesion-1", ejercicioId: "ej-1", ...overrides })
    ).rejects.toThrow(/VALIDATION_ERROR/);
    expect(prisma.registroDeProgreso.create).not.toHaveBeenCalled();
  });

  it.each([6, -1, 1.5])("rechaza un RIR fuera de 0–5 (%s)", async (rir) => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionEnCurso());

    await expect(
      registrarSerie({ sesionId: "sesion-1", ejercicioId: "ej-1", carga: 40, repeticiones: 10, rir })
    ).rejects.toThrow(/VALIDATION_ERROR.*RIR/i);
  });

  it("permite RIR nulo (dato opcional)", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionEnCurso());
    (prisma.registroDeProgreso.create as jest.Mock).mockResolvedValue({ id: "reg-1" });

    await expect(
      registrarSerie({ sesionId: "sesion-1", ejercicioId: "ej-1", carga: 40, repeticiones: 10 })
    ).resolves.toBeDefined();
  });

  it("lanza NOT_FOUND si la sesión no existe", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      registrarSerie({ sesionId: "nope", ejercicioId: "ej-1", carga: 40, repeticiones: 10 })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("finalizarSesion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("marca INCOMPLETA si todavía quedan series por hacer", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(
      sesionEnCurso({ serieActual: 2 })
    );
    const finalizada = { id: "sesion-1", estadoDeFinalizacion: "INCOMPLETA" };
    (prisma.sesionDeEntrenamiento.update as jest.Mock).mockResolvedValue(finalizada);

    const ahora = new Date("2026-10-12T14:00:00.000Z");
    const r = await finalizarSesion({ sesionId: "sesion-1", ahora });

    expect(r).toEqual(finalizada);
    expect(prisma.sesionDeEntrenamiento.update).toHaveBeenCalledWith({
      where: { id: "sesion-1" },
      data: { horaFin: ahora, estadoDeFinalizacion: "INCOMPLETA" },
    });
  });

  it("marca COMPLETADA si ya no quedan series (ejercicioActualId/serieActual nulos)", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(
      sesionEnCurso({ ejercicioActualId: null, serieActual: null })
    );
    (prisma.sesionDeEntrenamiento.update as jest.Mock).mockResolvedValue({
      id: "sesion-1",
      estadoDeFinalizacion: "COMPLETADA",
    });

    const r = await finalizarSesion({ sesionId: "sesion-1" });

    expect((r as { estadoDeFinalizacion: string }).estadoDeFinalizacion).toBe("COMPLETADA");
    expect(prisma.sesionDeEntrenamiento.update).toHaveBeenCalledWith({
      where: { id: "sesion-1" },
      data: { horaFin: expect.any(Date), estadoDeFinalizacion: "COMPLETADA" },
    });
  });

  it("es idempotente: una sesión ya finalizada no se vuelve a tocar", async () => {
    const prisma = await mocks();
    const yaFinalizada = { id: "sesion-1", estadoDeFinalizacion: "COMPLETADA", horaFin: new Date() };
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(yaFinalizada);

    const r = await finalizarSesion({ sesionId: "sesion-1" });

    expect(r).toEqual(yaFinalizada);
    expect(prisma.sesionDeEntrenamiento.update).not.toHaveBeenCalled();
  });

  it("lanza NOT_FOUND si la sesión no existe", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(finalizarSesion({ sesionId: "nope" })).rejects.toThrow("NOT_FOUND");
  });
});

describe("ultimaCarga", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve la última serie del socio para ese ejercicio", async () => {
    const prisma = await mocks();
    const fecha = new Date("2026-10-10T13:00:00.000Z");
    (prisma.registroDeProgreso.findFirst as jest.Mock).mockResolvedValue({
      carga: "42.5",
      repeticiones: 9,
      rir: 1,
      fecha,
    });

    const r = await ultimaCarga({ socioId: "socio-1", ejercicioId: "ej-1" });

    expect(r).toEqual({ carga: 42.5, repeticiones: 9, rir: 1, fecha });
    expect(prisma.registroDeProgreso.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1", ejercicioId: "ej-1" },
      orderBy: { fecha: "desc" },
    });
  });

  it("devuelve null si el socio nunca registró ese ejercicio", async () => {
    const prisma = await mocks();
    (prisma.registroDeProgreso.findFirst as jest.Mock).mockResolvedValue(null);

    expect(await ultimaCarga({ socioId: "socio-1", ejercicioId: "ej-1" })).toBeNull();
  });
});

describe("detalleSesionEnCurso", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve null si el socio no tiene sesión en curso", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue(null);

    expect(await detalleSesionEnCurso("socio-1")).toBeNull();
  });

  it("trae la rutina con sus ejercicios, la última serie y la carga actual precargada", async () => {
    const prisma = await mocks();
    const sesion = {
      id: "sesion-1",
      socioId: "socio-1",
      ejercicioActualId: "ej-1",
      serieActual: 2,
      rutinaAsignada: asignacionActiva(),
    };
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue(sesion);
    const fechaUltima = new Date("2026-10-12T13:05:00.000Z");
    (prisma.registroDeProgreso.findFirst as jest.Mock)
      // 1) última serie de la sesión (para retomar el cronómetro)
      .mockResolvedValueOnce({ ejercicioId: "ej-1", fecha: fechaUltima })
      // 2) última carga histórica del ejercicio actual (para precargar)
      .mockResolvedValueOnce({ carga: "42.5", repeticiones: 9, rir: 1, fecha: fechaUltima });

    const r = await detalleSesionEnCurso("socio-1");

    expect(r?.ejercicios).toEqual([
      { id: "ej-1", nombre: "Press banca", series: 2, repeticiones: 10, descanso: 60, orden: 0 },
      { id: "ej-2", nombre: "Sentadilla", series: 1, repeticiones: 8, descanso: 90, orden: 1 },
    ]);
    expect(r?.sesion).toBe(sesion);
    expect(r?.ultimaSerie).toEqual({ ejercicioId: "ej-1", fecha: fechaUltima });
    expect(r?.cargaActual).toEqual({ carga: 42.5, repeticiones: 9, rir: 1, fecha: fechaUltima });
    expect(prisma.sesionDeEntrenamiento.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { socioId: "socio-1", estadoDeFinalizacion: "EN_CURSO" },
        orderBy: { horaInicio: "desc" },
      })
    );
  });

  it("sin series registradas: ultimaSerie null y cargaActual null", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue({
      id: "sesion-1",
      socioId: "socio-1",
      ejercicioActualId: "ej-1",
      serieActual: 1,
      rutinaAsignada: asignacionActiva(),
    });
    (prisma.registroDeProgreso.findFirst as jest.Mock).mockResolvedValue(null);

    const r = await detalleSesionEnCurso("socio-1");

    expect(r?.ultimaSerie).toBeNull();
    expect(r?.cargaActual).toBeNull();
  });
});

describe("obtenerSesion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("busca la sesión por id (para verificar pertenencia en la capa API)", async () => {
    const prisma = await mocks();
    const sesion = { id: "sesion-1", socioId: "socio-1" };
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesion);

    const r = await obtenerSesion("sesion-1");

    expect(r).toEqual(sesion);
    expect(prisma.sesionDeEntrenamiento.findUnique).toHaveBeenCalledWith({
      where: { id: "sesion-1" },
    });
  });
});
