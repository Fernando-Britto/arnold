import type { SugerenciaVigenteLeida } from "@/domains/asignacion/asignacion-puerto";
import {
  calcularSinReservar,
  decidirSugerencia,
  existeSocio,
  reservaVigente,
  resolverSocioDeUsuario,
  tieneRutinaActiva,
  type SugerenciaSinReserva,
} from "@/domains/asignacion/orquestacion";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

export interface ActorAsignaciones {
  usuarioId: string;
  rol: "SOCIO" | "ADMINISTRADOR" | "INSTRUCTOR" | "RECEPCIONISTA";
}

export interface SolicitudSugerencia {
  actor: ActorAsignaciones;
  socioIdQuery: string | null;
  ahora: Date;
}

export interface SugerenciaDTO {
  asignacionId: string;
  ejercicioId: string;
  ejercicioNombre: string;
  maquinaId: string;
  maquinaNombre: string | null;
  esperaSegundos: number;
  ahorroSegundos: number;
  creadaEn: string;
  venceEn: string;
}

export interface SiguienteDTO {
  ejercicioId: string;
  ejercicioNombre: string;
  maquinaId: string | null;
  esperaSegundos: number;
}

export interface SolicitudDecision {
  actor: ActorAsignaciones;
  body: unknown;
  ahora: Date;
}

export interface RespuestaDecision {
  accion: "ACEPTAR" | "ESPERAR";
  sugerencia: SugerenciaDTO | null;
  siguienteEnOrden: SiguienteDTO | null;
}

export interface RespuestaSugerencia {
  socioId: string;
  sugerencia: SugerenciaDTO | null;
  siguienteEnOrden: SiguienteDTO | null;
  calculadoEn: string;
}

export interface ErrorBody {
  code: string;
  message: string;
}

export type ResultadoHandler<T> =
  | { status: 200; body: T }
  | { status: number; body: ErrorBody };

const MENSAJE_FORBIDDEN = "No tiene permiso para realizar esta acción";
const MENSAJE_SOCIO_NO_ENCONTRADO = "Socio no encontrado";

function error(status: number, code: string, message: string): ResultadoHandler<never> {
  return { status, body: { code, message } };
}

/** `calcularSinReservar` ya degrada solo; esta red cubre un fallo al resolver dependencias. */
async function siguienteSeguro(
  socioId: string,
  ahora: Date
): Promise<SiguienteDTO | null> {
  try {
    const siguiente = await calcularSinReservar({ socioId, ahora });
    return siguiente ? aSiguienteDTO(siguiente) : null;
  } catch (error) {
    console.error("[ASIGNACION][api]", { socioId, tipo: "siguiente", error });
    return null;
  }
}

function aSugerenciaDTO(sugerencia: SugerenciaVigenteLeida): SugerenciaDTO {
  return {
    asignacionId: sugerencia.id,
    ejercicioId: sugerencia.ejercicioId,
    ejercicioNombre: sugerencia.ejercicioNombre,
    maquinaId: sugerencia.maquinaId,
    maquinaNombre: sugerencia.maquinaNombre,
    esperaSegundos: sugerencia.esperaSegundos,
    ahorroSegundos: sugerencia.ahorroSegundos,
    creadaEn: sugerencia.creadaEn.toISOString(),
    venceEn: sugerencia.venceEn.toISOString(),
  };
}

function aSiguienteDTO(siguiente: SugerenciaSinReserva): SiguienteDTO {
  return {
    ejercicioId: siguiente.ejercicioId,
    ejercicioNombre: siguiente.ejercicioNombre,
    maquinaId: siguiente.maquinaId,
    esperaSegundos: siguiente.esperaSegundos,
  };
}

/**
 * `GET /api/asignaciones/sugerencia` sin conocer `NextRequest`. El SOCIO nunca puede elegir el
 * socio; ADMIN e INSTRUCTOR lo exigen explícitamente. No escribe.
 */
export async function handleObtenerSugerencia(
  solicitud: SolicitudSugerencia
): Promise<ResultadoHandler<RespuestaSugerencia>> {
  const { actor, socioIdQuery, ahora } = solicitud;

  try {
    let socioId: string;

    if (actor.rol === "SOCIO") {
      if (socioIdQuery !== null) return error(403, "FORBIDDEN", MENSAJE_FORBIDDEN);
      const resuelto = await resolverSocioDeUsuario(actor.usuarioId);
      if (!resuelto) return error(404, "NOT_FOUND", MENSAJE_SOCIO_NO_ENCONTRADO);
      socioId = resuelto;
    } else {
      if (!socioIdQuery) {
        return error(400, "VALIDATION_ERROR", "La solicitud no es válida: socioId es obligatorio");
      }
      if (!(await existeSocio(socioIdQuery))) {
        return error(404, "NOT_FOUND", MENSAJE_SOCIO_NO_ENCONTRADO);
      }
      socioId = socioIdQuery;
    }

    if (!(await tieneRutinaActiva(socioId))) {
      return {
        status: 200,
        body: { socioId, sugerencia: null, siguienteEnOrden: null, calculadoEn: ahora.toISOString() },
      };
    }

    const vigente = await reservaVigente({ socioId, ahora });
    const siguiente = await siguienteSeguro(socioId, ahora);

    return {
      status: 200,
      body: {
        socioId,
        sugerencia: vigente ? aSugerenciaDTO(vigente) : null,
        siguienteEnOrden: siguiente,
        calculadoEn: ahora.toISOString(),
      },
    };
  } catch (err) {
    const mapped = mapErrorToResponse(err, { resourceName: "Socio" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/** Body estricto: objeto plano con `accion` y nada más. */
function leerAccion(body: unknown): "ACEPTAR" | "ESPERAR" | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const claves = Object.keys(body);
  if (claves.length !== 1 || claves[0] !== "accion") return null;
  const accion = (body as { accion?: unknown }).accion;
  return accion === "ACEPTAR" || accion === "ESPERAR" ? accion : null;
}

function mensajeValidacion(): ErrorBody {
  return {
    code: "VALIDATION_ERROR",
    message: "La solicitud no es válida: solo se acepta accion (ACEPTAR o ESPERAR)",
  };
}

/**
 * `POST /api/asignaciones/decidir`. Solo el SOCIO decide, y siempre sobre lo propio:
 * el socio sale de la sesión y el body no puede elegirlo.
 */
export async function handleDecidirSugerencia(
  solicitud: SolicitudDecision
): Promise<ResultadoHandler<RespuestaDecision>> {
  const { actor, body, ahora } = solicitud;

  const accion = leerAccion(body);
  if (!accion) return { status: 400, body: mensajeValidacion() };

  if (actor.rol !== "SOCIO") return error(403, "FORBIDDEN", MENSAJE_FORBIDDEN);

  try {
    const socioId = await resolverSocioDeUsuario(actor.usuarioId);
    if (!socioId) return error(404, "NOT_FOUND", MENSAJE_SOCIO_NO_ENCONTRADO);

    const decision = await decidirSugerencia({ socioId, accion, ahora });

    if (decision.tipo === "sin_sugerencia") {
      // Los mensajes viven en `route-error-mapper`: acá solo viaja el código (D-102).
      const codigo = decision.motivo === "NUNCA_EXISTIO" ? "SIN_SUGERENCIA" : "SIN_SUGERENCIA_VIGENTE";
      throw Object.assign(new Error(codigo), { code: codigo });
    }

    if (decision.tipo === "contenido") {
      return error(500, "SERVER_ERROR", "No se pudo procesar la solicitud");
    }

    const siguiente = await siguienteSeguro(socioId, ahora);
    return {
      status: 200,
      body: {
        accion,
        sugerencia: decision.tipo === "aceptada" ? aSugerenciaDTO(decision.reserva) : null,
        siguienteEnOrden: siguiente,
      },
    };
  } catch (err) {
    const mapped = mapErrorToResponse(err, { resourceName: "Socio" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}
