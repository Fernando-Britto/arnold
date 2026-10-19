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
  seguimientoDeEjercicios,
  resumenDeSesion,
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
    registroDeProgreso: {
      create: jest.fn(),
      findFirst: jest.fn(),
      // D-58: sin historial por defecto; cada test que lo necesita define el suyo.
      findMany: jest.fn().mockResolvedValue([]),
    },
    // D-59: sin regla configurada por defecto (se usa el incremento de 2,5 kg).
    reglaDeProgresion: { findFirst: jest.fn().mockResolvedValue(null) },
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

// `clearAllMocks` no borra las implementaciones: sin esto, un `mockImplementation` de findMany en un
// test se filtraría al siguiente. Cada test arranca sin historial (D-58).
beforeEach(async () => {
  const prisma = await mocks();
  (prisma.registroDeProgreso.findMany as jest.Mock).mockReset().mockResolvedValue([]);
  (prisma.reglaDeProgresion.findFirst as jest.Mock).mockReset().mockResolvedValue(null);
});

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

/** Sesión pasada de ej-1 (2 series de 10 pedidas) con las dos series hechas a 40 kg. */
function historialCumplido(sesionId = "s-pasada", fecha = "2026-10-10T13:00:00.000Z") {
  return [
    { carga: "40", repeticiones: 10, rir: 2, numeroSerie: 2, fecha: new Date(fecha), sesionId },
    { carga: "40", repeticiones: 10, rir: 2, numeroSerie: 1, fecha: new Date(fecha), sesionId },
  ];
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
    // Sin historial previo no hay "última vez" (D-58).
    expect(r.ultimasVeces).toEqual({});
  });

  it("devuelve la última vez de cada ejercicio de la rutina (D-58)", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(asignacionActiva());
    (prisma.sesionDeEntrenamiento.create as jest.Mock).mockResolvedValue({ id: "sesion-nueva" });
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1"
          ? [
              { carga: "40", repeticiones: 10, rir: 2, numeroSerie: 1, fecha: new Date("2026-10-10T13:00:00.000Z"), sesionId: "s-pasada" },
            ]
          : []
    );

    const r = await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1" });

    expect(Object.keys(r.ultimasVeces)).toEqual(["ej-1"]);
    expect(r.ultimasVeces["ej-1"].series).toEqual([{ carga: 40, repeticiones: 10, rir: 2 }]);
  });

  it("sugiere la carga de la sesión (D-59): sube si la última vez hizo todas las repeticiones", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(asignacionActiva());
    (prisma.sesionDeEntrenamiento.create as jest.Mock).mockResolvedValue({ id: "sesion-nueva" });
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1" ? historialCumplido() : []
    );

    const r = await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1" });

    expect(r.sugerencias["ej-1"]).toMatchObject({ tipo: "subir", carga: 42.5 });
    // Sin historial no hay sugerencia: la pantalla ya dice "Primera vez".
    expect(r.sugerencias["ej-2"]).toBeUndefined();
  });

  it("devuelve los récords de cada ejercicio con historial para la línea en vivo (D-63)", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio-1" });
    (prisma.rutinaAsignada.findUnique as jest.Mock).mockResolvedValue(asignacionActiva());
    (prisma.sesionDeEntrenamiento.create as jest.Mock).mockResolvedValue({ id: "sesion-nueva" });
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1" ? historialCumplido() : []
    );

    const r = await iniciarSesion({ socioId: "socio-1", rutinaAsignadaId: "asig-1" });

    expect(r.records["ej-1"]).toEqual([{ carga: 40, repeticiones: 10 }]);
    expect(r.records["ej-2"]).toBeUndefined();
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

describe("registrarSerie con tipo de serie (T-047, D-64)", () => {
  beforeEach(async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockReset();
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockReset();
    (prisma.registroDeProgreso.create as jest.Mock).mockReset();
    (prisma.sesionDeEntrenamiento.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.registroDeProgreso.create as jest.Mock).mockResolvedValue({ id: "reg-1" });
  });

  const base = { sesionId: "sesion-1", ejercicioId: "ej-1", carga: 40, repeticiones: 10, rir: 2 };

  /** Lee la sesión una vez al empezar y otra al devolver el estado (como en la serie normal). */
  async function conSesion(overrides: Record<string, unknown> = {}) {
    const prisma = await mocks();
    const inicial = sesionEnCurso(overrides);
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock)
      .mockResolvedValueOnce(inicial)
      .mockResolvedValueOnce({ id: "sesion-1", ejercicioActualId: "ej-1", serieActual: 1 });
    return prisma;
  }

  it("sin tipo, la serie es NORMAL", async () => {
    const prisma = await conSesion();

    await registrarSerie(base);

    expect(prisma.registroDeProgreso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: "NORMAL", numeroSerie: 1 }),
    });
  });

  it("una serie HASTA_EL_FALLO ocupa una serie de la rutina y avanza la sesión", async () => {
    const prisma = await conSesion();

    await registrarSerie({ ...base, tipo: "HASTA_EL_FALLO" });

    expect(prisma.registroDeProgreso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: "HASTA_EL_FALLO", numeroSerie: 1 }),
    });
    expect(prisma.sesionDeEntrenamiento.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ejercicioActualId: "ej-1", serieActual: 2 } })
    );
  });

  it("un DROP_SET cuelga de la serie anterior: se guarda sin número y sin avanzar", async () => {
    const prisma = await conSesion();

    await registrarSerie({ ...base, tipo: "DROP_SET" });

    expect(prisma.registroDeProgreso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: "DROP_SET", numeroSerie: null }),
    });
    expect(prisma.sesionDeEntrenamiento.updateMany).not.toHaveBeenCalled();
  });

  describe("calentamiento", () => {
    it("se guarda sin número de serie y sin avanzar la sesión", async () => {
      const prisma = await conSesion();

      await registrarSerie({ ...base, carga: 20, repeticiones: 12, tipo: "CALENTAMIENTO" });

      expect(prisma.registroDeProgreso.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: "CALENTAMIENTO",
          numeroSerie: null,
          carga: 20,
          repeticiones: 12,
          sesionId: "sesion-1",
          socioId: "socio-1",
        }),
      });
      expect(prisma.sesionDeEntrenamiento.updateMany).not.toHaveBeenCalled();
    });

    it("devuelve la sesión tal como estaba: sigue en la misma serie", async () => {
      await conSesion();

      const r = await registrarSerie({ ...base, tipo: "CALENTAMIENTO" });

      expect(r.sesion).toMatchObject({ ejercicioActualId: "ej-1", serieActual: 1 });
      expect(r.registro).toEqual({ id: "reg-1" });
    });

    it("en la última serie del ejercicio tampoco pasa al siguiente ejercicio", async () => {
      const prisma = await conSesion({ serieActual: 2 });

      await registrarSerie({ ...base, tipo: "CALENTAMIENTO" });

      expect(prisma.sesionDeEntrenamiento.updateMany).not.toHaveBeenCalled();
    });

    it("valida igual que cualquier serie: tiene que ser el ejercicio actual", async () => {
      const prisma = await conSesion();

      await expect(
        registrarSerie({ ...base, ejercicioId: "ej-2", tipo: "CALENTAMIENTO" })
      ).rejects.toThrow(/VALIDATION_ERROR/);
      expect(prisma.registroDeProgreso.create).not.toHaveBeenCalled();
    });

    it("no se puede registrar si la sesión ya no está en curso", async () => {
      const prisma = await conSesion({ estadoDeFinalizacion: "COMPLETADA" });

      await expect(registrarSerie({ ...base, tipo: "CALENTAMIENTO" })).rejects.toThrow(
        /VALIDATION_ERROR/
      );
      expect(prisma.registroDeProgreso.create).not.toHaveBeenCalled();
    });
  });

  it("un tipo inexistente es un error de validación y no toca la base", async () => {
    const prisma = await mocks();

    await expect(registrarSerie({ ...base, tipo: "SUPERSET" as never })).rejects.toThrow(
      /VALIDATION_ERROR: El tipo de serie no es válido/
    );
    expect(prisma.sesionDeEntrenamiento.findUnique).not.toHaveBeenCalled();
    expect(prisma.registroDeProgreso.create).not.toHaveBeenCalled();
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
    // D-64: la carga que se precarga nunca es la de un calentamiento.
    expect(prisma.registroDeProgreso.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1", ejercicioId: "ej-1", tipo: { not: "CALENTAMIENTO" } },
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
    expect(r?.ultimasVeces).toEqual({});
  });

  it("incluye la última vez de cada ejercicio y excluye la sesión en curso (D-58)", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue({
      id: "sesion-1",
      socioId: "socio-1",
      ejercicioActualId: "ej-1",
      serieActual: 2,
      rutinaAsignada: asignacionActiva(),
    });
    (prisma.registroDeProgreso.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1"
          ? [
              // Serie ya hecha hoy en la sesión en curso: NO es "última vez".
              { carga: "50", repeticiones: 8, rir: 1, numeroSerie: 1, fecha: new Date("2026-10-16T13:00:00.000Z"), sesionId: "sesion-1" },
              { carga: "45", repeticiones: 8, rir: 2, numeroSerie: 2, fecha: new Date("2026-10-10T13:05:00.000Z"), sesionId: "s-pasada" },
              { carga: "42.5", repeticiones: 10, rir: 3, numeroSerie: 1, fecha: new Date("2026-10-10T13:00:00.000Z"), sesionId: "s-pasada" },
            ]
          : []
    );

    const r = await detalleSesionEnCurso("socio-1");

    expect(r?.ultimasVeces["ej-1"].series).toEqual([
      { carga: 42.5, repeticiones: 10, rir: 3 },
      { carga: 45, repeticiones: 8, rir: 2 },
    ]);
    expect(r?.ultimasVeces["ej-2"]).toBeUndefined();
  });

  it("incluye la sugerencia y no deja que la sesión en curso la condicione (D-59)", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue({
      id: "sesion-1",
      socioId: "socio-1",
      ejercicioActualId: "ej-1",
      serieActual: 2,
      rutinaAsignada: asignacionActiva(),
    });
    (prisma.registroDeProgreso.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1"
          ? [
              // Una serie floja de HOY no puede hacer que el motor "falle" la sesión anterior.
              { carga: "40", repeticiones: 3, rir: 0, numeroSerie: 1, fecha: new Date("2026-10-16T13:00:00.000Z"), sesionId: "sesion-1" },
              ...historialCumplido(),
            ]
          : []
    );

    const r = await detalleSesionEnCurso("socio-1");

    expect(r?.sugerencias["ej-1"]).toMatchObject({ tipo: "subir", carga: 42.5 });
  });

  it("incluye los récords sin contar las series de la sesión en curso (D-63)", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue({
      id: "sesion-1",
      socioId: "socio-1",
      ejercicioActualId: "ej-1",
      serieActual: 2,
      rutinaAsignada: asignacionActiva(),
    });
    (prisma.registroDeProgreso.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1"
          ? [
              // Lo de hoy no puede ser el récord a superar hoy.
              { carga: "60", repeticiones: 12, rir: 0, numeroSerie: 1, fecha: new Date("2026-10-16T13:00:00.000Z"), sesionId: "sesion-1" },
              ...historialCumplido(),
            ]
          : []
    );

    const r = await detalleSesionEnCurso("socio-1");

    expect(r?.records["ej-1"]).toEqual([{ carga: 40, repeticiones: 10 }]);
  });

  it("la última serie de la sesión incluye los calentamientos: sirve para retomar el descanso (D-64)", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findFirst as jest.Mock).mockResolvedValue({
      id: "sesion-1",
      socioId: "socio-1",
      ejercicioActualId: "ej-1",
      serieActual: 1,
      rutinaAsignada: asignacionActiva(),
    });
    (prisma.registroDeProgreso.findFirst as jest.Mock).mockResolvedValue(null);

    await detalleSesionEnCurso("socio-1");

    // Un calentamiento también es descanso: esta consulta NO filtra por tipo, a diferencia de
    // las que miden progreso. Si algún día se "corrige" para filtrarlo, el cronómetro se rompe.
    const deLaSesion = (prisma.registroDeProgreso.findFirst as jest.Mock).mock.calls
      .map(([arg]) => arg)
      .find((arg) => arg.where.sesionId === "sesion-1");
    expect(deLaSesion.where).toEqual({ sesionId: "sesion-1" });
  });

  it("sin historial devuelve sugerencias vacías", async () => {
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

    expect(r?.sugerencias).toEqual({});
  });
});

describe("seguimientoDeEjercicios (D-59)", () => {
  const ej1 = { ejercicioId: "ej-1", series: 2, repeticiones: 10 };

  it("lee las últimas sesiones una sola vez por ejercicio para armar la última vez y la sugerencia", async () => {
    const prisma = await mocks();
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue(historialCumplido());

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1] });

    const recientes = (prisma.registroDeProgreso.findMany as jest.Mock).mock.calls.filter(
      ([arg]) => arg.take === 50
    );
    expect(recientes).toHaveLength(1);
    expect(r.ultimasVeces["ej-1"].series).toHaveLength(2);
    expect(r.sugerencias["ej-1"]).toMatchObject({ tipo: "subir", carga: 42.5 });
  });

  it("sin ejercicios no consulta la base", async () => {
    const prisma = await mocks();

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [] });

    expect(r).toEqual({ ultimasVeces: {}, sugerencias: {}, records: {} });
    expect(prisma.registroDeProgreso.findMany).not.toHaveBeenCalled();
    expect(prisma.reglaDeProgresion.findFirst).not.toHaveBeenCalled();
  });

  it("usa el incremento de la ReglaDeProgresion LINEAL", async () => {
    const prisma = await mocks();
    (prisma.reglaDeProgresion.findFirst as jest.Mock).mockResolvedValue({ incrementoSugerido: "5" });
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue(historialCumplido());

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1] });

    expect(prisma.reglaDeProgresion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipo: "LINEAL" } })
    );
    expect(r.sugerencias["ej-1"].carga).toBe(45);
  });

  it("si la regla no es un número válido usa el incremento por defecto", async () => {
    const prisma = await mocks();
    (prisma.reglaDeProgresion.findFirst as jest.Mock).mockResolvedValue({ incrementoSugerido: "0" });
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue(historialCumplido());

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1] });

    expect(r.sugerencias["ej-1"].carga).toBe(42.5);
  });

  it("no juzga las sesiones anteriores al último cambio del ejercicio en la rutina", async () => {
    const prisma = await mocks();
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue(historialCumplido());

    const r = await seguimientoDeEjercicios({
      socioId: "socio-1",
      ejercicios: [{ ...ej1, updatedAt: new Date("2026-10-12T00:00:00.000Z") }],
    });

    expect(r.sugerencias["ej-1"]).toMatchObject({ tipo: "mantener", carga: 40 });
    expect(r.sugerencias["ej-1"].motivo).toMatch(/cambió el plan/i);
  });

  it("descarga tras tres sesiones seguidas sin llegar a las repeticiones", async () => {
    const prisma = await mocks();
    const fallida = (id: string, fecha: string) => [
      { carga: "40", repeticiones: 10, rir: 1, numeroSerie: 1, fecha: new Date(fecha), sesionId: id },
      { carga: "40", repeticiones: 7, rir: 0, numeroSerie: 2, fecha: new Date(fecha), sesionId: id },
    ];
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
      ...fallida("s-3", "2026-10-14T13:00:00.000Z"),
      ...fallida("s-2", "2026-10-07T13:00:00.000Z"),
      ...fallida("s-1", "2026-10-01T13:00:00.000Z"),
    ]);

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1] });

    expect(r.sugerencias["ej-1"]).toMatchObject({ tipo: "descargar", carga: 35 });
  });

  describe("récords para la línea en vivo (T-046c, D-63)", () => {
    it("devuelve la frontera de récords de las sesiones anteriores, con todo el historial", async () => {
      const prisma = await mocks();
      (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
        ...historialCumplido("s-pasada", "2026-10-10T13:00:00.000Z"),
        { carga: "50", repeticiones: 6, rir: 1, numeroSerie: 1, fecha: new Date("2026-09-01T13:00:00.000Z"), sesionId: "s-vieja" },
      ]);

      const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1], sesionActualId: "s-actual" });

      expect(r.records["ej-1"]).toEqual([
        { carga: 40, repeticiones: 10 },
        { carga: 50, repeticiones: 6 },
      ]);
    });

    it("no cuenta las series de la sesión en curso: el récord es lo anterior", async () => {
      const prisma = await mocks();
      (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
        { carga: "60", repeticiones: 12, rir: 0, numeroSerie: 1, fecha: new Date("2026-10-16T13:00:00.000Z"), sesionId: "s-actual" },
        ...historialCumplido(),
      ]);

      const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1], sesionActualId: "s-actual" });

      expect(r.records["ej-1"]).toEqual([{ carga: 40, repeticiones: 10 }]);
    });

    it("los registros viejos sin sesión cuentan como historia", async () => {
      const prisma = await mocks();
      (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
        { carga: "40", repeticiones: 10, rir: 2, numeroSerie: 1, fecha: new Date("2026-01-05T13:00:00.000Z"), sesionId: null },
      ]);

      const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1], sesionActualId: "s-actual" });

      expect(r.records["ej-1"]).toEqual([{ carga: 40, repeticiones: 10 }]);
    });

    it("lee todo el historial del ejercicio, sin tope, y solo las columnas necesarias", async () => {
      const prisma = await mocks();
      (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue(historialCumplido());

      await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1] });

      const historica = (prisma.registroDeProgreso.findMany as jest.Mock).mock.calls
        .map(([arg]) => arg)
        .find((arg) => arg.take === undefined);
      expect(historica.where).toEqual({
      socioId: "socio-1",
      ejercicioId: "ej-1",
      carga: { gt: 0 },
      // D-64: el calentamiento no es una marca ni un récord.
      tipo: { not: "CALENTAMIENTO" },
    });
      expect(historica.select).toEqual({ carga: true, repeticiones: true, sesionId: true });
    });

    it("un ejercicio sin series con carga no aparece", async () => {
      const prisma = await mocks();
      (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([]);

      const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej1] });

      expect(r.records).toEqual({});
    });
  });
});
describe("seguimientoDeEjercicios: lectura del historial (D-58)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("consulta una vez por ejercicio (sin repetir ids), del socio y acotado", async () => {
    const prisma = await mocks();

    await seguimientoDeEjercicios({
      socioId: "socio-1",
      ejercicios: [
        { ejercicioId: "ej-1", series: 2, repeticiones: 10 },
        { ejercicioId: "ej-2", series: 1, repeticiones: 8 },
        { ejercicioId: "ej-1", series: 2, repeticiones: 10 },
      ],
    });

    // Dos ejercicios distintos: una lectura de las últimas sesiones por cada uno (el id repetido no suma).
    const recientes = (prisma.registroDeProgreso.findMany as jest.Mock).mock.calls.filter(
      ([arg]) => arg.take === 50
    );
    expect(recientes).toHaveLength(2);
    expect(prisma.registroDeProgreso.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // D-64: el calentamiento no cuenta para la última vez ni para la progresión.
        where: { socioId: "socio-1", ejercicioId: "ej-1", tipo: { not: "CALENTAMIENTO" } },
        orderBy: { fecha: "desc" },
        take: 50,
      })
    );
  });

  it("convierte la carga Decimal a número y completa RIR y número de serie nulos", async () => {
    const prisma = await mocks();
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
      { carga: "37.5", repeticiones: 12, rir: null, numeroSerie: null, fecha: new Date("2026-10-05T13:00:00.000Z"), sesionId: null },
    ]);

    const r = await seguimientoDeEjercicios({
      socioId: "socio-1",
      ejercicios: [{ ejercicioId: "ej-1", series: 1, repeticiones: 10 }],
    });

    expect(r.ultimasVeces["ej-1"].series).toEqual([{ carga: 37.5, repeticiones: 12, rir: null }]);
  });
});

describe("resumenDeSesion (T-046b, D-62)", () => {
  beforeEach(() => jest.clearAllMocks());

  const registro = (sesionId: string, numeroSerie: number, carga: string, repeticiones: number, fecha: string) => ({
    carga,
    repeticiones,
    rir: 2,
    numeroSerie,
    fecha: new Date(fecha),
    sesionId,
  });

  function sesionTerminada(overrides: Record<string, unknown> = {}) {
    return {
      id: "s-hoy",
      socioId: "socio-1",
      horaInicio: new Date("2026-10-16T13:00:00.000Z"),
      horaFin: new Date("2026-10-16T13:52:00.000Z"),
      rutinaAsignada: asignacionActiva(),
      ...overrides,
    };
  }

  /** ej-1 (2 × 10): hoy a 42,5 kg y la sesión anterior a 40 kg. ej-2: sin series hoy. */
  async function conHistorial() {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(sesionTerminada());
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1"
          ? [
              registro("s-hoy", 2, "42.5", 10, "2026-10-16T13:30:00.000Z"),
              registro("s-hoy", 1, "42.5", 10, "2026-10-16T13:20:00.000Z"),
              registro("s-1", 2, "40", 10, "2026-10-09T13:30:00.000Z"),
              registro("s-1", 1, "40", 10, "2026-10-09T13:20:00.000Z"),
            ]
          : []
    );
    return prisma;
  }

  it("arma, por ejercicio, lo de hoy, la tendencia y la próxima carga", async () => {
    await conHistorial();

    const r = await resumenDeSesion("s-hoy");

    expect(r.sesionId).toBe("s-hoy");
    expect(r.ejercicios).toHaveLength(1);
    expect(r.ejercicios[0]).toMatchObject({
      ejercicioId: "ej-1",
      nombre: "Press banca",
      tendencia: "subio",
      proxima: { tipo: "subir", carga: 45 },
    });
    expect(r.ejercicios[0].hoy).toEqual([
      { carga: 42.5, repeticiones: 10, rir: 2 },
      { carga: 42.5, repeticiones: 10, rir: 2 },
    ]);
    expect(r.ejercicios[0].ultimaVez?.series).toHaveLength(2);
  });

  it("cuenta las series hechas y la duración en minutos", async () => {
    await conHistorial();

    const r = await resumenDeSesion("s-hoy");

    expect(r.seriesHechas).toBe(2);
    expect(r.duracionMinutos).toBe(52);
  });

  it("deja afuera los ejercicios de los que no se hizo ninguna serie", async () => {
    await conHistorial();

    const r = await resumenDeSesion("s-hoy");

    expect(r.ejercicios.map((e) => e.ejercicioId)).toEqual(["ej-1"]);
  });

  it("sin hora de fin la duración es null", async () => {
    const prisma = await conHistorial();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(
      sesionTerminada({ horaFin: null })
    );

    expect((await resumenDeSesion("s-hoy")).duracionMinutos).toBeNull();
  });

  it("usa el incremento de la ReglaDeProgresion LINEAL", async () => {
    const prisma = await conHistorial();
    (prisma.reglaDeProgresion.findFirst as jest.Mock).mockResolvedValue({ incrementoSugerido: "5" });

    const r = await resumenDeSesion("s-hoy");

    expect(r.ejercicios[0].proxima.carga).toBe(47.5);
  });

  it("no juzga las sesiones anteriores al último cambio del ejercicio en la rutina", async () => {
    const prisma = await mocks();
    const falla = (id: string, dia: number) => [
      registro(id, 1, "40", 7, `2026-10-${String(dia).padStart(2, "0")}T13:00:00.000Z`),
      registro(id, 2, "40", 7, `2026-10-${String(dia).padStart(2, "0")}T13:05:00.000Z`),
    ];
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1"
          ? [...falla("s-hoy", 16), ...falla("s-3", 13), ...falla("s-2", 10), ...falla("s-1", 7)]
          : []
    );
    const asignacion = asignacionActiva();
    // El profesor cambió el ejercicio el 14/10: lo anterior es de otro plan.
    asignacion.rutina.ejercicios[0] = {
      ...asignacion.rutina.ejercicios[0],
      updatedAt: new Date("2026-10-14T00:00:00.000Z"),
    } as never;
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(
      sesionTerminada({ rutinaAsignada: asignacion })
    );

    const r = await resumenDeSesion("s-hoy");

    // Sin el cambio de plan serían cuatro fallos seguidos (descarga); con él, solo cuenta hoy.
    expect(r.ejercicios[0].proxima).toMatchObject({ tipo: "mantener", carga: 40 });
  });

  it("anuncia las marcas nuevas contra todo el historial anterior (D-63)", async () => {
    await conHistorial();

    const r = await resumenDeSesion("s-hoy");

    expect(r.ejercicios[0].marcas).toEqual({
      carga: { valor: 42.5, anterior: 40 },
      // 42,5 × 10 → 56,7 → 56,5 contra 40 × 10 → 53,3 → 53,5.
      e1rm: { valor: 56.5, anterior: 53.5 },
    });
  });

  it("los registros viejos sin sesión cuentan como anteriores", async () => {
    const prisma = await conHistorial();
    (prisma.registroDeProgreso.findMany as jest.Mock).mockImplementation(
      async ({ where }: { where: { ejercicioId: string } }) =>
        where.ejercicioId === "ej-1"
          ? [
              registro("s-hoy", 1, "42.5", 10, "2026-10-16T13:20:00.000Z"),
              // Anterior a que existieran las sesiones: sesionId null. Es la única referencia.
              { ...registro("x", 1, "40", 10, "2026-01-05T13:00:00.000Z"), sesionId: null },
            ]
          : []
    );

    const r = await resumenDeSesion("s-hoy");

    // Si ese registro se descartara por no tener sesión, no habría con qué comparar y no habría marca.
    expect(r.ejercicios[0].marcas.carga).toEqual({ valor: 42.5, anterior: 40 });
  });

  it("para las marcas lee todo el historial del ejercicio, sin tope, y solo lo necesario", async () => {
    const prisma = await conHistorial();

    await resumenDeSesion("s-hoy");

    const consultas = (prisma.registroDeProgreso.findMany as jest.Mock).mock.calls
      .map(([arg]) => arg)
      .filter((arg) => arg.where.ejercicioId === "ej-1");
    const historica = consultas.find((arg) => arg.take === undefined);
    expect(historica).toBeDefined();
    expect(historica.where).toEqual({
      socioId: "socio-1",
      ejercicioId: "ej-1",
      carga: { gt: 0 },
      // D-64: el calentamiento no es una marca ni un récord.
      tipo: { not: "CALENTAMIENTO" },
    });
    expect(historica.select).toEqual({ carga: true, repeticiones: true, sesionId: true });
  });

  it("lanza NOT_FOUND si la sesión no existe", async () => {
    const prisma = await mocks();
    (prisma.sesionDeEntrenamiento.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(resumenDeSesion("nope")).rejects.toThrow("NOT_FOUND");
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

describe("seguimientoDeEjercicios: tipos de serie (T-047 parte 2, D-64)", () => {
  beforeEach(() => jest.clearAllMocks());

  const ej = { ejercicioId: "ej-1", series: 2, repeticiones: 10 };
  const fila = (numeroSerie: number, carga: string, repeticiones: number, tipo: string) => ({
    carga,
    repeticiones,
    rir: 2,
    numeroSerie,
    fecha: new Date(`2026-10-09T13:0${numeroSerie}:00.000Z`),
    sesionId: "s-1",
    tipo,
  });

  it("lee el tipo de cada serie junto con el resto del historial", async () => {
    const prisma = await mocks();

    await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej] });

    const recientes = (prisma.registroDeProgreso.findMany as jest.Mock).mock.calls.find(
      ([arg]) => arg.take === 50
    );
    expect(recientes?.[0].select).toMatchObject({ tipo: true });
  });

  it("la última vez conserva el tipo de las series que no son normales", async () => {
    const prisma = await mocks();
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
      fila(2, "30", 6, "DROP_SET"),
      fila(1, "40", 10, "NORMAL"),
    ]);

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej] });

    expect(r.ultimasVeces["ej-1"].series).toEqual([
      { carga: 40, repeticiones: 10, rir: 2 },
      { carga: 30, repeticiones: 6, rir: 2, tipo: "DROP_SET" },
    ]);
  });

  it("un drop set no reemplaza la serie de trabajo que falta: mantiene el peso", async () => {
    const prisma = await mocks();
    // 2 × 10: la serie 1 cumple y la 2 es un drop set. El drop no cuenta como la segunda.
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
      fila(2, "30", 4, "DROP_SET"),
      fila(1, "40", 10, "NORMAL"),
    ]);

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej] });

    expect(r.sugerencias["ej-1"]).toMatchObject({ tipo: "mantener", carga: 40 });
  });

  it("con las dos series de trabajo hechas, un drop set extra no frena la subida", async () => {
    const prisma = await mocks();
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
      fila(3, "30", 4, "DROP_SET"),
      fila(2, "40", 10, "NORMAL"),
      fila(1, "40", 10, "NORMAL"),
    ]);

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej] });

    expect(r.sugerencias["ej-1"]).toMatchObject({ tipo: "subir", carga: 42.5 });
  });

  it("la misma sesión con la segunda serie normal y floja sí mantiene el peso", async () => {
    const prisma = await mocks();
    (prisma.registroDeProgreso.findMany as jest.Mock).mockResolvedValue([
      fila(2, "30", 4, "NORMAL"),
      fila(1, "40", 10, "NORMAL"),
    ]);

    const r = await seguimientoDeEjercicios({ socioId: "socio-1", ejercicios: [ej] });

    expect(r.sugerencias["ej-1"].tipo).toBe("mantener");
  });
});

