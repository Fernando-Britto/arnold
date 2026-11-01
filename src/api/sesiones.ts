/**
 * Capa API de sesiones de entrenamiento (T-037). Los handlers delegan en el dominio
 * (`src/domains/sesion/sesion-de-entrenamiento.ts`) y `resolveSocioIdDeUsuario` mapea la
 * identidad de la sesión (cookie/Bearer) a la fila de `Socio`, para verificar pertenencia.
 *
 * La verificación de propiedad vive en las rutas: un SOCIO solo actúa sobre sus sesiones;
 * ADMINISTRADOR/INSTRUCTOR pueden leer.
 */
import { timeoutsDeEntorno } from "@/lib/asignacion-timeouts";
import {
  iniciarSesion,
  obtenerSesion,
  detalleSesionEnCurso,
  registrarSerie,
  finalizarSesion,
  resumenDeSesion,
  type DetalleSesionEnCurso,
  type FinalizarSesionInput,
  type IniciarSesionInput,
  type RegistrarSerieInput,
} from "@/domains/sesion/sesion-de-entrenamiento";
import { throwIfNotOk } from "@/utils/api-error";

export type {
  DetalleSesionEnCurso,
  FinalizarSesionInput,
  IniciarSesionInput,
  RegistrarSerieInput,
  SerieRegistrada,
  SesionIniciada,
  UltimaCarga,
} from "@/domains/sesion/sesion-de-entrenamiento";

/** Handle POST /api/sesiones — inicia una sesión de entrenamiento. */
export async function handleIniciarSesion(input: IniciarSesionInput) {
  return iniciarSesion({ ...input, timeouts: timeoutsDeEntorno() });
}

/** Handle POST /api/sesiones/[id]/series — registra una serie. */
export async function handleRegistrarSerie(input: RegistrarSerieInput) {
  return registrarSerie({ ...input, timeouts: timeoutsDeEntorno() });
}

/** Handle GET /api/sesiones/[id]/resumen — resumen de la sesión (T-046b, D-62). */
export async function handleResumenSesion(sesionId: string) {
  return resumenDeSesion(sesionId);
}

/** Handle PUT /api/sesiones/[id] — finaliza la sesión. */
export async function handleFinalizarSesion(input: FinalizarSesionInput) {
  return finalizarSesion(input);
}

/**
 * Handle GET /api/sesiones?enCurso=1 — sesión EN_CURSO del socio con el detalle para
 * retomarla (ejercicios de la rutina, última serie y última carga), o null (T-038).
 */
export async function handleSesionEnCurso(
  socioId: string
): Promise<DetalleSesionEnCurso | null> {
  return detalleSesionEnCurso(socioId);
}

/** Sesión por id (para verificar pertenencia en la ruta), o null. */
export async function handleObtenerSesion(sesionId: string) {
  return obtenerSesion(sesionId);
}

/**
 * Id de la fila `Socio` del usuario autenticado, o null si el usuario no es socio.
 * Prisma se importa en forma diferida (mismo patrón que el dominio).
 */
export async function resolveSocioIdDeUsuario(usuarioId: string): Promise<string | null> {
  const { prisma } = await import("@/lib/db");
  const socio = await prisma.socio.findUnique({
    where: { usuarioId },
    select: { id: true },
  });
  return socio?.id ?? null;
}

/**
 * ============================================
 * CLIENT-SIDE API FUNCTIONS (for the run screen)
 * ============================================
 */

/** Serie de la sesión anterior, tal como llega del servidor (D-58). */
export interface SerieUltimaVezDTO {
  carga: number;
  repeticiones: number;
  rir: number | null;
  /** Solo si no es una serie normal (D-64): drop set o hasta el fallo. */
  tipo?: TipoSerieDTO;
}

/** "Última vez" de un ejercicio: las series de la sesión anterior (D-58). */
export interface UltimaVezDTO {
  fecha: string;
  series: SerieUltimaVezDTO[];
}

/** Tipo de serie tal como viaja entre el servidor y la pantalla (D-64). */
export type TipoSerieDTO = "NORMAL" | "CALENTAMIENTO" | "HASTA_EL_FALLO" | "DROP_SET";

/** Una serie de la frontera de récords: repeticiones hechas con esa carga (T-046c, D-63). */
export interface SerieMarcaDTO {
  carga: number;
  repeticiones: number;
}

/** Carga sugerida para hoy y el porqué, tal como llega del servidor (D-59). */
export interface SugerenciaDTO {
  tipo: "primera" | "subir" | "mantener" | "descargar";
  /** kg; null si no hay un número honesto que sugerir. */
  carga: number | null;
  motivo: string;
}

/** Cómo le fue hoy comparado con la última vez en un ejercicio (T-046b, D-62). */
export type TendenciaDTO = "subio" | "bajo" | "igual" | "primera";

/** Una marca personal batida hoy: el valor nuevo y el que había (T-046c, D-63). */
export interface MarcaNuevaDTO {
  valor: number;
  anterior: number;
}

/** Marcas personales que hoy se superaron; null si no se superó ninguna de ese tipo. */
export interface MarcasNuevasDTO {
  /** Mayor carga levantada en el ejercicio. */
  carga: MarcaNuevaDTO | null;
  /** Mejor 1RM estimado (Epley, hasta 12 repeticiones), redondeado a 0,5 kg. */
  e1rm: MarcaNuevaDTO | null;
}

/** Resumen de un ejercicio al terminar la sesión (T-046b, D-62). */
export interface ResumenEjercicioDTO {
  ejercicioId: string;
  nombre: string;
  /** Series de hoy, en el orden en que se hicieron. */
  hoy: SerieUltimaVezDTO[];
  /** La sesión anterior con este ejercicio; null si es la primera vez. */
  ultimaVez: UltimaVezDTO | null;
  tendencia: TendenciaDTO;
  /** Marcas personales que hoy se superaron (T-046c, D-63). */
  marcas: MarcasNuevasDTO;
  /** Carga para la próxima sesión, contando la de hoy: la misma que se va a precargar. */
  proxima: SugerenciaDTO;
}

/** Resumen de la sesión que llega de `GET /api/sesiones/[id]/resumen` (T-046b, D-62). */
export interface ResumenSesionDTO {
  sesionId: string;
  seriesHechas: number;
  /** Minutos entre el inicio y el fin; null si no hay hora de fin. */
  duracionMinutos: number | null;
  ejercicios: ResumenEjercicioDTO[];
}

/** Ejercicio de la rutina con la prescripción (target) tal como llega del servidor. */
export interface EjercicioDeSesionDTO {
  id: string;
  nombre: string;
  series: number;
  repeticiones: number;
  /** Descanso tras el ejercicio, en segundos. */
  descanso: number;
  orden: number;
  /** Catálogo de ejercicios (D-70): `null` y `[]` en un ejercicio cargado a mano. */
  mediaId: string | null;
  musculoObjetivo: string | null;
  instrucciones: string[];
}

/** Detalle de la sesión en curso que consume la pantalla de ejecución (T-038). */
export interface SesionEnCursoDTO {
  sesion: {
    id: string;
    socioId: string;
    rutinaAsignadaId: string;
    estadoDeFinalizacion: string;
    horaInicio: string;
    /** `Ejercicio.id` en curso; null cuando ya se completaron todas las series. */
    ejercicioActualId: string | null;
    serieActual: number | null;
  } | null;
  ejercicios: EjercicioDeSesionDTO[];
  /** Última serie registrada de la sesión; su `fecha` es el inicio del descanso. */
  ultimaSerie: { ejercicioId: string; fecha: string } | null;
  /** Última carga histórica del ejercicio actual, para precargar. */
  cargaActual: { carga: number; repeticiones: number; rir: number | null; fecha: string } | null;
  /** "Última vez" por `Ejercicio.id`; los ejercicios que nunca hizo no aparecen (D-58). */
  ultimasVeces: Record<string, UltimaVezDTO>;
  /** Carga sugerida por `Ejercicio.id`; sin historial no hay sugerencia (D-59). */
  sugerencias: Record<string, SugerenciaDTO>;
  /** Frontera de récords por `Ejercicio.id` para la línea en vivo; sin historial no hay (D-63). */
  records: Record<string, SerieMarcaDTO[]>;
}

/** Respuesta de registrar una serie (T-037/T-038). */
/** Un drop set: la carga reducida y las repeticiones que hizo con ella (P-46, D-69). */
export interface DropDeSerieDTO {
  carga: number;
  repeticiones: number;
}

export interface SerieRegistradaDTO {
  registro: {
    id: string;
    fecha: string;
    numeroSerie: number | null;
    carga: number;
    repeticiones: number;
    rir: number | null;
  };
  sesion: {
    id: string;
    ejercicioActualId: string | null;
    serieActual: number | null;
  };
  /** Los drop sets guardados junto con la serie, en orden (P-46, D-69). Puede faltar en un servidor anterior. */
  drops?: Array<{ id: string; carga: number; repeticiones: number }>;
}

/** Respuesta de iniciar una sesión (T-037/T-038). */
export interface SesionIniciadaDTO {
  sesion: {
    id: string;
    rutinaAsignadaId: string;
    estadoDeFinalizacion: string;
    horaInicio: string;
    ejercicioActualId: string | null;
    serieActual: number | null;
  };
  ejercicios: EjercicioDeSesionDTO[];
  /** "Última vez" por `Ejercicio.id`; los ejercicios que nunca hizo no aparecen (D-58). */
  ultimasVeces: Record<string, UltimaVezDTO>;
  /** Carga sugerida por `Ejercicio.id`; sin historial no hay sugerencia (D-59). */
  sugerencias: Record<string, SugerenciaDTO>;
  /** Frontera de récords por `Ejercicio.id` para la línea en vivo; sin historial no hay (D-63). */
  records: Record<string, SerieMarcaDTO[]>;
}

/**
 * Client-side fetches: la sesión viaja en la cookie (HttpOnly); el cliente no adjunta
 * headers de auth (PG-7).
 */

/** GET /api/sesiones?enCurso=1 — sesión en curso del socio con el detalle para retomar. */
export async function fetchSesionEnCurso(): Promise<SesionEnCursoDTO> {
  const response = await fetch("/api/sesiones?enCurso=1");
  await throwIfNotOk(response, "No se pudo cargar la sesión en curso");
  return response.json();
}

/** POST /api/sesiones — inicia una sesión de entrenamiento para la rutina asignada. */
export async function iniciarSesionDeEntrenamiento(
  rutinaAsignadaId: string
): Promise<SesionIniciadaDTO> {
  const response = await fetch("/api/sesiones", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rutinaAsignadaId }),
  });
  await throwIfNotOk(response, "No se pudo iniciar la sesión");
  return response.json();
}

/** POST /api/sesiones/[id]/series — registra una serie de la sesión. */
export async function registrarSerieDeEntrenamiento(
  sesionId: string,
  input: {
    ejercicioId: string;
    carga: number;
    repeticiones: number;
    rir?: number | null;
    /** Tipo de serie (D-64); sin él es NORMAL. El drop set no es un tipo: va en `drops`. */
    tipo?: TipoSerieDTO;
    /** Drop sets colgados de esta serie (P-46, D-69): hasta 5, con menos carga. */
    drops?: DropDeSerieDTO[];
  }
): Promise<SerieRegistradaDTO> {
  const response = await fetch(`/api/sesiones/${sesionId}/series`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  await throwIfNotOk(response, "No se pudo registrar la serie");
  return response.json();
}

/** PUT /api/sesiones/[id] — finaliza la sesión de entrenamiento. */
export async function finalizarSesionDeEntrenamiento(sesionId: string) {
  const response = await fetch(`/api/sesiones/${sesionId}`, {
    method: "PUT",
  });
  await throwIfNotOk(response, "No se pudo finalizar la sesión");
  return response.json();
}

/** GET /api/sesiones/[id]/resumen — resumen de la sesión terminada (T-046b, D-62). */
export async function fetchResumenDeSesion(sesionId: string): Promise<ResumenSesionDTO> {
  const response = await fetch(`/api/sesiones/${sesionId}/resumen`);
  await throwIfNotOk(response, "No pudimos cargar el resumen de la sesión");
  return response.json();
}
