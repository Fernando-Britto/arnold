/**
 * Sesión de entrenamiento (T-037, D-44/D-48): iniciar, registrar por serie, finalizar y
 * consultar la última carga. Prisma va por dentro con import diferido.
 *
 * Modelo de estado para retomar una sesión (D-44):
 *  - `estadoDeFinalizacion: "EN_CURSO"` mientras el socio entrena.
 *  - `ejercicioActualId` guarda el `Ejercicio.id` del ejercicio en curso (el primero por `orden`
 *    al iniciar). Es `null` cuando ya se completaron todas las series.
 *  - `serieActual` es el número de serie en curso (1-based); `null` al terminar.
 *
 * D-48: se registra UNA fila de `RegistroDeProgreso` por serie, con `numeroSerie`, `rir` (0–5)
 * y ligada a la sesión. El cronómetro de descanso se calcula fuera de acá, con `horaInicio`.
 *
 * Spec: openspec/specs/home-socio-portal/spec.md
 */

export const RIR_MIN = 0;
export const RIR_MAX = 5;

export interface IniciarSesionInput {
  socioId: string;
  rutinaAsignadaId: string;
  /** Inyectable en tests; en producción es `new Date()`. */
  ahora?: Date;
}

export interface RegistrarSerieInput {
  sesionId: string;
  /** `Ejercicio.id` del ejercicio en curso. */
  ejercicioId: string;
  carga: number;
  repeticiones: number;
  rir?: number | null;
  /** Inyectable en tests; en producción es `new Date()`. */
  ahora?: Date;
}

export interface FinalizarSesionInput {
  sesionId: string;
  ahora?: Date;
}

export interface UltimaCargaInput {
  socioId: string;
  ejercicioId: string;
}

/** Ejercicio de la rutina tal como lo necesita la UI de la sesión. */
export interface EjercicioDeSesion {
  id: string;
  nombre: string;
  series: number;
  repeticiones: number;
  descanso: number; // segundos
  orden: number;
}

export interface SesionIniciada {
  sesion: unknown;
  ejercicios: EjercicioDeSesion[];
}

export interface SerieRegistrada {
  registro: unknown;
  sesion: unknown;
}

export interface UltimaCarga {
  carga: number;
  repeticiones: number;
  rir: number | null;
  fecha: Date;
}

/** Ejercicio de la rutina con lo mínimo para mapear la respuesta. */
interface EjercicioEnRutinaConEjercicio {
  ejercicioId: string;
  series: number;
  repeticiones: number;
  descanso: number;
  orden: number;
  ejercicio: { id: string; nombre: string };
}

/** Rutina asignada con sus ejercicios ordenados, como la devuelve Prisma. */
interface AsignacionConRutina {
  id: string;
  socioId: string;
  activa: boolean;
  rutina: { ejercicios: EjercicioEnRutinaConEjercicio[] };
}

/** Sesión con la rutina asignada incluida (para registrar series). */
interface SesionConRutina {
  id: string;
  socioId: string;
  estadoDeFinalizacion: string;
  ejercicioActualId: string | null;
  serieActual: number | null;
  rutinaAsignada: { rutina: { ejercicios: EjercicioEnRutinaConEjercicio[] } };
}

function mapearEjercicios(ejercicios: EjercicioEnRutinaConEjercicio[]): EjercicioDeSesion[] {
  return ejercicios
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((e) => ({
      id: e.ejercicio.id,
      nombre: e.ejercicio.nombre,
      series: e.series,
      repeticiones: e.repeticiones,
      descanso: e.descanso,
      orden: e.orden,
    }));
}

function validarRir(rir: number | null): number | null {
  if (rir === null) return null;
  if (!Number.isInteger(rir) || rir < RIR_MIN || rir > RIR_MAX) {
    throw new Error(
      `VALIDATION_ERROR: El RIR debe ser un entero entre ${RIR_MIN} y ${RIR_MAX}`
    );
  }
  return rir;
}

/**
 * Inicia una sesión de entrenamiento para un socio a partir de una rutina asignada activa.
 * Crea `SesionDeEntrenamiento` en `EN_CURSO` apuntando al primer ejercicio (por `orden`).
 *
 * Regla de abandono (SE-1/SE-3): si el socio ya tiene una sesión `EN_CURSO`, se marca como
 * `ABANDONADA` (con `horaFin`) dentro de la misma transacción antes de crear la nueva. Así
 * `ABANDONADA` tiene un disparador real y se cumple "a lo sumo una `EN_CURSO` por socio".
 *
 * @throws Error("NOT_FOUND: ...") con el recurso que falta (socio o asignación) en el mensaje,
 *   para que el mapa de errores no muestre siempre el mismo "Rutina asignada" (SE-6).
 * @throws Error("VALIDATION_ERROR: ...") si la asignación no está activa o no es del socio.
 */
export async function iniciarSesion(input: IniciarSesionInput): Promise<SesionIniciada> {
  const { prisma } = await import("@/lib/db");

  const socio = await prisma.socio.findUnique({
    where: { id: input.socioId },
    select: { id: true },
  });
  // SE-6: el error lleva su propio recurso. Con `code: "NOT_FOUND"` el mapa de errores
  // usa este mensaje en vez del `resourceName` fijo de la ruta.
  if (!socio) {
    throw Object.assign(new Error("NOT_FOUND: Socio no encontrado"), { code: "NOT_FOUND" });
  }

  const asignada = (await prisma.rutinaAsignada.findUnique({
    where: { id: input.rutinaAsignadaId },
    include: {
      rutina: {
        include: {
          ejercicios: {
            orderBy: { orden: "asc" },
            include: { ejercicio: { select: { id: true, nombre: true } } },
          },
        },
      },
    },
  })) as unknown as AsignacionConRutina | null;

  if (!asignada) {
    throw Object.assign(new Error("NOT_FOUND: Rutina asignada no encontrada"), {
      code: "NOT_FOUND",
    });
  }
  if (!asignada.activa) {
    throw new Error("VALIDATION_ERROR: La rutina asignada no está activa");
  }
  if (asignada.socioId !== input.socioId) {
    throw new Error("VALIDATION_ERROR: La rutina asignada no pertenece al socio");
  }

  const ejercicios = asignada.rutina.ejercicios;
  const primero = ejercicios[0] ?? null;
  const ahora = input.ahora ?? new Date();

  // SE-1/SE-3: una sesión nueva cuando ya hay una EN_CURSO deja la anterior en ABANDONADA
  // (con horaFin). Así `ABANDONADA` tiene un disparador real y se mantiene el invariante
  // "a lo sumo una EN_CURSO por socio". El abandono y la creación van en UNA transacción.
  //
  // Sin un índice único parcial (no se puede sin cambio de schema), dos inicios 100%
  // concurrentes y sin sesión previa todavía podrían crear dos EN_CURSO. La transacción
  // cubre el caso secuencial (el habitual: el socio recarga y vuelve a empezar).
  const sesion = await prisma.$transaction(async (tx) => {
    await tx.sesionDeEntrenamiento.updateMany({
      where: { socioId: input.socioId, estadoDeFinalizacion: "EN_CURSO" },
      data: { estadoDeFinalizacion: "ABANDONADA", horaFin: ahora },
    });

    return tx.sesionDeEntrenamiento.create({
      data: {
        socioId: input.socioId,
        rutinaAsignadaId: input.rutinaAsignadaId,
        estadoDeFinalizacion: "EN_CURSO",
        horaInicio: ahora,
        ejercicioActualId: primero ? primero.ejercicioId : null,
        serieActual: primero ? 1 : null,
      },
    });
  });

  return { sesion, ejercicios: mapearEjercicios(ejercicios) };
}

/**
 * Sesión EN_CURSO del socio (la más reciente), o `null` si no hay ninguna.
 */
export async function obtenerSesionEnCurso(socioId: string) {
  const { prisma } = await import("@/lib/db");
  return prisma.sesionDeEntrenamiento.findFirst({
    where: { socioId, estadoDeFinalizacion: "EN_CURSO" },
    orderBy: { horaInicio: "desc" },
  });
}

/**
 * Sesión por id (para verificar pertenencia en la capa API), o `null`.
 */
export async function obtenerSesion(sesionId: string) {
  const { prisma } = await import("@/lib/db");
  return prisma.sesionDeEntrenamiento.findUnique({ where: { id: sesionId } });
}

export interface UltimaSerieDeSesion {
  /** `Ejercicio.id` de la serie registrada más reciente de la sesión. */
  ejercicioId: string;
  /** `fecha` de esa serie: es el inicio del descanso para retomar el cronómetro (D-48). */
  fecha: Date;
}

export interface DetalleSesionEnCurso {
  sesion: unknown;
  ejercicios: EjercicioDeSesion[];
  ultimaSerie: UltimaSerieDeSesion | null;
  /** Última carga histórica del ejercicio actual, para precargar la UI. */
  cargaActual: UltimaCarga | null;
}

/**
 * Sesión EN_CURSO del socio con lo necesario para retomarla tras una recarga (T-038):
 * los ejercicios de la rutina con su prescripción, la última serie registrada (hora de
 * inicio guardada del descanso) y la última carga del ejercicio actual.
 */
export async function detalleSesionEnCurso(
  socioId: string
): Promise<DetalleSesionEnCurso | null> {
  const { prisma } = await import("@/lib/db");

  const sesion = (await prisma.sesionDeEntrenamiento.findFirst({
    where: { socioId, estadoDeFinalizacion: "EN_CURSO" },
    orderBy: { horaInicio: "desc" },
    include: {
      rutinaAsignada: {
        include: {
          rutina: {
            include: {
              ejercicios: {
                orderBy: { orden: "asc" },
                include: { ejercicio: { select: { id: true, nombre: true } } },
              },
            },
          },
        },
      },
    },
  })) as unknown as SesionConRutina | null;

  if (!sesion) return null;

  const ultima = (await prisma.registroDeProgreso.findFirst({
    where: { sesionId: sesion.id },
    orderBy: { fecha: "desc" },
  })) as unknown as { ejercicioId: string; fecha: Date } | null;

  const cargaActual = sesion.ejercicioActualId
    ? await ultimaCarga({ socioId, ejercicioId: sesion.ejercicioActualId })
    : null;

  return {
    sesion,
    ejercicios: mapearEjercicios(sesion.rutinaAsignada.rutina.ejercicios),
    ultimaSerie: ultima ? { ejercicioId: ultima.ejercicioId, fecha: ultima.fecha } : null,
    cargaActual,
  };
}

/**
 * Registra una serie y avanza el estado de la sesión: crea el `RegistroDeProgreso` con el
 * `numeroSerie` actual y, en UNA transacción, actualiza `ejercicioActualId`/`serieActual`.
 * Al completar las series del ejercicio pasa al siguiente (por `orden`); al completar el
 * último ejercicio deja ambos en `null` (sesión lista para finalizar como COMPLETADA).
 *
 * @throws Error("NOT_FOUND") si la sesión no existe.
 * @throws Error("VALIDATION_ERROR: ...") si la sesión no está en curso, el ejercicio no es el
 *   actual, o `carga`/`repeticiones`/`rir` están fuera de rango.
 */
export async function registrarSerie(input: RegistrarSerieInput): Promise<SerieRegistrada> {
  const { prisma } = await import("@/lib/db");

  if (typeof input.carga !== "number" || !Number.isFinite(input.carga) || input.carga < 0) {
    throw new Error("VALIDATION_ERROR: La carga debe ser un número mayor o igual a 0");
  }
  if (!Number.isInteger(input.repeticiones) || input.repeticiones < 1) {
    throw new Error("VALIDATION_ERROR: Las repeticiones deben ser un entero mayor o igual a 1");
  }
  const rir = validarRir(input.rir ?? null);

  return prisma.$transaction(async (tx) => {
    // SE-2: la lectura y revalidación de la sesión van DENTRO de la transacción. Si se
    // leyera afuera, un doble envío concurrente podría calcular el mismo `numeroSerie`
    // a partir del mismo `serieActual` y perder el avance.
    const sesion = (await tx.sesionDeEntrenamiento.findUnique({
      where: { id: input.sesionId },
      include: {
        rutinaAsignada: {
          include: {
            rutina: { include: { ejercicios: { orderBy: { orden: "asc" } } } },
          },
        },
      },
    })) as unknown as SesionConRutina | null;

    if (!sesion) throw new Error("NOT_FOUND");
    if (sesion.estadoDeFinalizacion !== "EN_CURSO") {
      throw new Error("VALIDATION_ERROR: La sesión no está en curso");
    }
    if (sesion.serieActual === null || sesion.ejercicioActualId === null) {
      throw new Error("VALIDATION_ERROR: La sesión no tiene un ejercicio en curso");
    }
    if (sesion.ejercicioActualId !== input.ejercicioId) {
      throw new Error("VALIDATION_ERROR: El ejercicio no es el actual de la sesión");
    }

    const ejercicios = sesion.rutinaAsignada.rutina.ejercicios;
    const idxActual = ejercicios.findIndex((e) => e.ejercicioId === sesion.ejercicioActualId);
    if (idxActual < 0) {
      throw new Error("VALIDATION_ERROR: El ejercicio actual no pertenece a la rutina de la sesión");
    }

    const actual = ejercicios[idxActual];
    const numeroSerie = sesion.serieActual;

    let siguienteEjercicioId: string | null = sesion.ejercicioActualId;
    let siguienteSerie: number | null = numeroSerie + 1;
    if (numeroSerie >= actual.series) {
      const siguiente = ejercicios[idxActual + 1];
      if (siguiente) {
        siguienteEjercicioId = siguiente.ejercicioId;
        siguienteSerie = 1;
      } else {
        siguienteEjercicioId = null;
        siguienteSerie = null;
      }
    }

    // Guarda optimista: solo avanza si el estado sigue siendo el que leímos. Si otro
    // request ya avanzó `serieActual` (o movió el ejercicio), `count === 0` y abortamos
    // en vez de duplicar el `numeroSerie` y pisar el avance.
    const guardado = await tx.sesionDeEntrenamiento.updateMany({
      where: {
        id: sesion.id,
        estadoDeFinalizacion: "EN_CURSO",
        serieActual: numeroSerie,
        ejercicioActualId: sesion.ejercicioActualId,
      },
      data: {
        ejercicioActualId: siguienteEjercicioId,
        serieActual: siguienteSerie,
      },
    });
    if (guardado.count === 0) {
      throw new Error(
        "VALIDATION_ERROR: La sesión fue modificada por un registro concurrente; recargá e intentá de nuevo"
      );
    }

    const registro = await tx.registroDeProgreso.create({
      data: {
        socioId: sesion.socioId,
        ejercicioId: input.ejercicioId,
        carga: input.carga,
        repeticiones: input.repeticiones,
        rir,
        numeroSerie,
        sesionId: sesion.id,
        fecha: input.ahora,
      },
    });
    const sesionActualizada = await tx.sesionDeEntrenamiento.findUnique({
      where: { id: sesion.id },
    });
    return { registro, sesion: sesionActualizada };
  });
}

/**
 * Finaliza una sesión: setea `horaFin` y `COMPLETADA` (o `INCOMPLETA` si quedan series).
 * Idempotente: si la sesión ya estaba finalizada, la devuelve sin tocarla.
 *
 * @throws Error("NOT_FOUND") si la sesión no existe.
 */
export async function finalizarSesion(input: FinalizarSesionInput) {
  const { prisma } = await import("@/lib/db");

  const sesion = await prisma.sesionDeEntrenamiento.findUnique({
    where: { id: input.sesionId },
  });
  if (!sesion) throw new Error("NOT_FOUND");

  if ((sesion as { estadoDeFinalizacion: string }).estadoDeFinalizacion !== "EN_CURSO") {
    return sesion;
  }

  const completo = (sesion as { serieActual: number | null }).serieActual === null;

  return prisma.sesionDeEntrenamiento.update({
    where: { id: input.sesionId },
    data: {
      horaFin: input.ahora ?? new Date(),
      estadoDeFinalizacion: completo ? "COMPLETADA" : "INCOMPLETA",
    },
  });
}

/**
 * Última serie registrada del socio para un ejercicio (para precargar la UI), o `null`.
 */
export async function ultimaCarga(input: UltimaCargaInput): Promise<UltimaCarga | null> {
  const { prisma } = await import("@/lib/db");

  const registro = await prisma.registroDeProgreso.findFirst({
    where: { socioId: input.socioId, ejercicioId: input.ejercicioId },
    orderBy: { fecha: "desc" },
  });
  if (!registro) return null;

  const r = registro as unknown as {
    carga: unknown;
    repeticiones: number;
    rir: number | null;
    fecha: Date;
  };

  return {
    carga: Number(r.carga),
    repeticiones: r.repeticiones,
    rir: r.rir ?? null,
    fecha: r.fecha,
  };
}
