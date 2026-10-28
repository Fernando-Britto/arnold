import type { SugerenciaVigenteLeida } from "@/domains/asignacion/asignacion-puerto";
import {
  calcularSinReservar,
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
