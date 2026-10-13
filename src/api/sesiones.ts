/**
 * Capa API de sesiones de entrenamiento (T-037). Los handlers delegan en el dominio
 * (`src/domains/sesion/sesion-de-entrenamiento.ts`) y `resolveSocioIdDeUsuario` mapea la
 * identidad de la sesión (cookie/Bearer) a la fila de `Socio`, para verificar pertenencia.
 *
 * La verificación de propiedad vive en las rutas: un SOCIO solo actúa sobre sus sesiones;
 * ADMINISTRADOR/INSTRUCTOR pueden leer.
 */
import {
  iniciarSesion,
  obtenerSesion,
  detalleSesionEnCurso,
  registrarSerie,
  finalizarSesion,
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
  return iniciarSesion(input);
}

/** Handle POST /api/sesiones/[id]/series — registra una serie. */
export async function handleRegistrarSerie(input: RegistrarSerieInput) {
  return registrarSerie(input);
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

/** Ejercicio de la rutina con la prescripción (target) tal como llega del servidor. */
export interface EjercicioDeSesionDTO {
  id: string;
  nombre: string;
  series: number;
  repeticiones: number;
  /** Descanso tras el ejercicio, en segundos. */
  descanso: number;
  orden: number;
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
}

/** Respuesta de registrar una serie (T-037/T-038). */
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
}

/** Authorization header con el JWT de localStorage (mismo patrón que pagos/socios). */
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** GET /api/sesiones?enCurso=1 — sesión en curso del socio con el detalle para retomar. */
export async function fetchSesionEnCurso(): Promise<SesionEnCursoDTO> {
  const response = await fetch("/api/sesiones?enCurso=1", {
    headers: { ...getAuthHeaders() },
  });
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
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ rutinaAsignadaId }),
  });
  await throwIfNotOk(response, "No se pudo iniciar la sesión");
  return response.json();
}

/** POST /api/sesiones/[id]/series — registra una serie de la sesión. */
export async function registrarSerieDeEntrenamiento(
  sesionId: string,
  input: { ejercicioId: string; carga: number; repeticiones: number; rir?: number | null }
): Promise<SerieRegistradaDTO> {
  const response = await fetch(`/api/sesiones/${sesionId}/series`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
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
    headers: { ...getAuthHeaders() },
  });
  await throwIfNotOk(response, "No se pudo finalizar la sesión");
  return response.json();
}
