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
 * D-58: junto con la sesión se devuelve la "última vez" de cada ejercicio de la rutina (las series
 * de la sesión anterior), derivada del historial con `historial-ejercicio.ts`.
 *
 * Spec: openspec/specs/home-socio-portal/spec.md
 */
import { DEFAULT_INCREMENTO_KG } from "@/domains/home-socio/home-socio";
import { agruparSesiones, type RegistroHistorico, type UltimaVez } from "./historial-ejercicio";
import { sugerirProximaCarga, type Sugerencia } from "./progresion-ejercicio";
import { fronteraDeRecords, type SerieMarca } from "./marcas-ejercicio";
import {
  SOLO_SERIES_DE_TRABAJO,
  TIPO_SERIE_POR_DEFECTO,
  esTipoSerie,
  type TipoSerie,
} from "./tipo-serie";
import { resumirEjercicio, type ResumenEjercicio } from "./resumen-sesion";

export type { UltimaVez } from "./historial-ejercicio";
export type { Sugerencia } from "./progresion-ejercicio";
export type { ResumenEjercicio, Tendencia } from "./resumen-sesion";
export type { MarcaNueva, MarcasNuevas } from "./marcas-ejercicio";
export type { TipoSerie } from "./tipo-serie";

/** Registros que se leen por ejercicio para armar la "última vez" (más que una sesión típica). */
const REGISTROS_PARA_ULTIMA_VEZ = 50;

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
  /** Tipo de serie (D-64); sin él es NORMAL. */
  tipo?: TipoSerie;
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
  /** "Última vez" por `Ejercicio.id`; los ejercicios que nunca hizo no aparecen (D-58). */
  ultimasVeces: Record<string, UltimaVez>;
  /** Carga sugerida por `Ejercicio.id` (D-59); sin historial no hay sugerencia. */
  sugerencias: Record<string, Sugerencia>;
  /** Frontera de récords por `Ejercicio.id` para la línea en vivo (D-63); sin historial no hay. */
  records: Record<string, SerieMarca[]>;
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
  /** Último cambio de la fila; las sesiones anteriores son de otro plan (D-59). */
  updatedAt?: Date;
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

  const { ultimasVeces, sugerencias, records } = await seguimientoDeEjercicios({
    socioId: input.socioId,
    ejercicios,
    sesionActualId: (sesion as { id: string }).id,
  });

  return { sesion, ejercicios: mapearEjercicios(ejercicios), ultimasVeces, sugerencias, records };
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
  /** "Última vez" por `Ejercicio.id`; los ejercicios que nunca hizo no aparecen (D-58). */
  ultimasVeces: Record<string, UltimaVez>;
  /** Carga sugerida por `Ejercicio.id` (D-59); sin historial no hay sugerencia. */
  sugerencias: Record<string, Sugerencia>;
  /** Frontera de récords por `Ejercicio.id` para la línea en vivo (D-63); sin historial no hay. */
  records: Record<string, SerieMarca[]>;
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

  const { ultimasVeces, sugerencias, records } = await seguimientoDeEjercicios({
    socioId,
    ejercicios: sesion.rutinaAsignada.rutina.ejercicios,
    sesionActualId: sesion.id,
  });

  return {
    sesion,
    ejercicios: mapearEjercicios(sesion.rutinaAsignada.rutina.ejercicios),
    ultimaSerie: ultima ? { ejercicioId: ultima.ejercicioId, fecha: ultima.fecha } : null,
    cargaActual,
    ultimasVeces,
    sugerencias,
    records,
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
  const tipo = input.tipo ?? TIPO_SERIE_POR_DEFECTO;
  if (!esTipoSerie(tipo)) {
    throw new Error("VALIDATION_ERROR: El tipo de serie no es válido");
  }

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

    // D-64: ni el calentamiento ni el drop set son una de las series que pide la rutina. Se
    // guardan sin número de serie y SIN mover la sesión (ni siquiera en la última serie del
    // ejercicio): el socio sigue parado donde estaba. Un drop set cuelga de la serie anterior,
    // así que tampoco dispara el descanso largo (lo resuelve la pantalla).
    if (tipo === "CALENTAMIENTO" || tipo === "DROP_SET") {
      const registro = await tx.registroDeProgreso.create({
        data: {
          socioId: sesion.socioId,
          ejercicioId: input.ejercicioId,
          carga: input.carga,
          repeticiones: input.repeticiones,
          rir,
          numeroSerie: null,
          tipo,
          sesionId: sesion.id,
          fecha: input.ahora,
        },
      });
      const sinCambios = await tx.sesionDeEntrenamiento.findUnique({ where: { id: sesion.id } });
      return { registro, sesion: sinCambios };
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
        tipo,
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
    // D-64: la carga que se precarga es la de una serie de trabajo, nunca la de un calentamiento.
    where: { socioId: input.socioId, ejercicioId: input.ejercicioId, ...SOLO_SERIES_DE_TRABAJO },
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

export interface SeguimientoInput {
  socioId: string;
  /** Ejercicios de la rutina con lo que pide cada uno. */
  ejercicios: Array<{
    ejercicioId: string;
    series: number;
    repeticiones: number;
    /** Último cambio del ejercicio en la rutina: lo anterior es de otro plan (D-59). */
    updatedAt?: Date | null;
  }>;
  /** Sesión en curso: sus series no cuentan como historial. */
  sesionActualId?: string | null;
}

export interface Seguimiento {
  ultimasVeces: Record<string, UltimaVez>;
  sugerencias: Record<string, Sugerencia>;
  /** Frontera de récords de las sesiones anteriores, por ejercicio (D-63). */
  records: Record<string, SerieMarca[]>;
}

/** Incremento de la `ReglaDeProgresion` LINEAL, o el de por defecto si no hay una válida. */
async function incrementoLineal(): Promise<number> {
  const { prisma } = await import("@/lib/db");
  const regla = await prisma.reglaDeProgresion.findFirst({
    where: { tipo: "LINEAL" },
    select: { incrementoSugerido: true },
  });
  const incremento = regla ? Number(regla.incrementoSugerido) : NaN;
  return Number.isFinite(incremento) && incremento > 0 ? incremento : DEFAULT_INCREMENTO_KG;
}

/** Los últimos registros de UN ejercicio del socio: una consulta acotada. */
async function registrosDeEjercicio(
  socioId: string,
  ejercicioId: string
): Promise<RegistroHistorico[]> {
  const { prisma } = await import("@/lib/db");
  const filas = (await prisma.registroDeProgreso.findMany({
    // D-64: el calentamiento no cuenta para la última vez ni para la progresión.
    where: { socioId, ejercicioId, ...SOLO_SERIES_DE_TRABAJO },
    orderBy: { fecha: "desc" },
    take: REGISTROS_PARA_ULTIMA_VEZ,
    select: {
      carga: true,
      repeticiones: true,
      rir: true,
      numeroSerie: true,
      fecha: true,
      sesionId: true,
      // D-64: el motor y la "última vez" necesitan saber qué series son drop set o al fallo.
      tipo: true,
    },
  })) as unknown as Array<{
    carga: unknown;
    repeticiones: number;
    rir: number | null;
    numeroSerie: number | null;
    fecha: Date;
    sesionId: string | null;
    tipo: TipoSerie | null;
  }>;

  return filas.map((f) => ({
    carga: Number(f.carga),
    repeticiones: f.repeticiones,
    rir: f.rir ?? null,
    numeroSerie: f.numeroSerie ?? null,
    fecha: f.fecha,
    sesionId: f.sesionId ?? null,
    tipo: f.tipo ?? "NORMAL",
  }));
}

/**
 * TODAS las series con carga de UN ejercicio del socio, sin tope de antigüedad, con lo mínimo
 * para las marcas personales (D-63). Va aparte de `registrosDeEjercicio` porque afirmar un
 * récord con la ventana acotada de las últimas sesiones puede ser falso para un levantamiento viejo.
 */
async function seriesHistoricas(
  socioId: string,
  ejercicioId: string
): Promise<Array<SerieMarca & { sesionId: string | null }>> {
  const { prisma } = await import("@/lib/db");
  const filas = (await prisma.registroDeProgreso.findMany({
    // D-64: el calentamiento no es una marca ni un récord.
    where: { socioId, ejercicioId, carga: { gt: 0 }, ...SOLO_SERIES_DE_TRABAJO },
    select: { carga: true, repeticiones: true, sesionId: true },
  })) as unknown as Array<{ carga: unknown; repeticiones: number; sesionId: string | null }>;

  return filas.map((f) => ({
    carga: Number(f.carga),
    repeticiones: f.repeticiones,
    sesionId: f.sesionId ?? null,
  }));
}

/**
 * Seguimiento de cada ejercicio de la rutina: la "última vez" (D-58) y la carga sugerida para
 * hoy (D-59). Los ejercicios sin historial no aparecen en ninguno de los dos resultados.
 *
 * Se consulta por ejercicio (en paralelo) y UNA sola vez: de las mismas filas salen la última
 * vez y la sugerencia, así la pantalla no promete un número distinto al que muestra. Una consulta
 * por ejercicio, y no un único `take` global, evita que un ejercicio que el socio no hace hace
 * meses quede fuera por los registros de los demás.
 */
export async function seguimientoDeEjercicios(input: SeguimientoInput): Promise<Seguimiento> {
  const vacio: Seguimiento = { ultimasVeces: {}, sugerencias: {}, records: {} };
  if (input.ejercicios.length === 0) return vacio;

  const unicos = [...new Map(input.ejercicios.map((e) => [e.ejercicioId, e])).values()];
  const [incremento, historialPorEjercicio] = await Promise.all([
    incrementoLineal(),
    Promise.all(
      unicos.map(async (e) => {
        const [registros, historicas] = await Promise.all([
          registrosDeEjercicio(input.socioId, e.ejercicioId),
          seriesHistoricas(input.socioId, e.ejercicioId),
        ]);
        return [e, agruparSesiones(registros, input.sesionActualId), historicas] as const;
      })
    ),
  ]);

  const resultado: Seguimiento = { ultimasVeces: {}, sugerencias: {}, records: {} };
  for (const [ejercicio, sesiones, historicas] of historialPorEjercicio) {
    const ultima = sesiones.at(-1);
    if (!ultima) continue;
    resultado.ultimasVeces[ejercicio.ejercicioId] = ultima;
    resultado.sugerencias[ejercicio.ejercicioId] = sugerirProximaCarga(
      sesiones,
      { series: ejercicio.series, repeticiones: ejercicio.repeticiones },
      incremento,
      ejercicio.updatedAt ?? null
    );

    // El récord a superar es lo de ANTES de esta sesión. Se filtra acá y no en la consulta:
    // `sesionId <> x` en SQL descarta los registros viejos con `sesionId` NULL, que son historia.
    const frontera = fronteraDeRecords(
      historicas.filter((h) => !input.sesionActualId || h.sesionId !== input.sesionActualId)
    );
    if (frontera.length > 0) resultado.records[ejercicio.ejercicioId] = frontera;
  }
  return resultado;
}

export interface ResumenSesion {
  sesionId: string;
  /** Series hechas en la sesión, sumando todos los ejercicios. */
  seriesHechas: number;
  /** Minutos entre el inicio y el fin; null si la sesión no tiene hora de fin. */
  duracionMinutos: number | null;
  /** Los ejercicios en los que se hizo al menos una serie, en el orden de la rutina. */
  ejercicios: ResumenEjercicio[];
}

/**
 * Resumen de una sesión (T-046b, D-62): por ejercicio, lo de hoy contra la última vez y la carga
 * que se va a sugerir en la próxima sesión. Lee el historial de cada ejercicio una sola vez y se
 * lo entrega a las funciones puras de `resumen-sesion.ts`, que usan el mismo motor que arma la
 * sesión siguiente: el resumen no promete un número distinto del que después se precarga.
 *
 * @throws Error("NOT_FOUND") si la sesión no existe.
 */
export async function resumenDeSesion(sesionId: string): Promise<ResumenSesion> {
  const { prisma } = await import("@/lib/db");

  const sesion = (await prisma.sesionDeEntrenamiento.findUnique({
    where: { id: sesionId },
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
  })) as unknown as
    | (SesionConRutina & { horaInicio: Date; horaFin: Date | null })
    | null;
  if (!sesion) throw new Error("NOT_FOUND");

  const incrementoKg = await incrementoLineal();
  const ejercicios = [...sesion.rutinaAsignada.rutina.ejercicios].sort((a, b) => a.orden - b.orden);

  const resumenes = await Promise.all(
    ejercicios.map(async (e) => {
      const [registros, historicas] = await Promise.all([
        registrosDeEjercicio(sesion.socioId, e.ejercicioId),
        seriesHistoricas(sesion.socioId, e.ejercicioId),
      ]);
      return resumirEjercicio({
        ejercicioId: e.ejercicioId,
        nombre: e.ejercicio.nombre,
        prescripcion: { series: e.series, repeticiones: e.repeticiones },
        registros,
        sesionId,
        incrementoKg,
        planDesde: e.updatedAt ?? null,
        // Lo anterior a esta sesión. Se filtra acá y no en la consulta: `sesionId <> x` en SQL
        // descarta los registros viejos con `sesionId` NULL, que también son historia.
        seriesAnteriores: historicas.filter((h) => h.sesionId !== sesionId),
      });
    })
  );
  const hechos = resumenes.filter((r): r is ResumenEjercicio => r !== null);

  return {
    sesionId,
    seriesHechas: hechos.reduce((total, r) => total + r.hoy.length, 0),
    duracionMinutos: sesion.horaFin
      ? Math.max(1, Math.round((sesion.horaFin.getTime() - sesion.horaInicio.getTime()) / 60_000))
      : null,
    ejercicios: hechos,
  };
}
