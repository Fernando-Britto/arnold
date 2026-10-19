import { NextRequest, NextResponse } from "next/server";
import {
  handleIniciarSesion,
  handleSesionEnCurso,
  resolveSocioIdDeUsuario,
} from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** Roles que pueden iniciar/registrar/finalizar sus propias sesiones (D-44). */
const ALLOWED_WRITE_ROLES = ["SOCIO", "ADMINISTRADOR"];
/** Roles que pueden leer sesiones: SOCIO (las propias) y el staff (D-44). */
const ALLOWED_READ_ROLES = ["SOCIO", "ADMINISTRADOR", "INSTRUCTOR"];

const MENSAJE_SIN_PERMISO = "Se requiere rol de socio o administrador";

interface HandlerResult {
  status: number;
  body: unknown;
}

/** Respuesta uniforme de error del proxy de datos (mismo sobre que el resto de la API). */
function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * Core handler logic for POST /api/sesiones.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleIniciarSesionRequest(body: {
  socioId: string;
  rutinaAsignadaId: string;
}): Promise<HandlerResult> {
  try {
    const result = await handleIniciarSesion(body);
    return { status: 201, body: result };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: MENSAJE_SIN_PERMISO,
      resourceName: "Rutina asignada",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * Core handler logic for GET /api/sesiones?enCurso=1.
 * Devuelve el detalle de la sesión en curso (ejercicios de la rutina, última serie y
 * última carga) para que la pantalla de ejecución la retome tras una recarga (T-038).
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleSesionEnCursoRequest(socioId: string): Promise<HandlerResult> {
  try {
    const detalle = await handleSesionEnCurso(socioId);
    const body = detalle ?? {
      sesion: null,
      ejercicios: [],
      ultimaSerie: null,
      cargaActual: null,
      ultimasVeces: {},
      sugerencias: {},
      records: {},
    };
    return { status: 200, body };
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/sesiones — inicia una sesión de entrenamiento.
 * Un SOCIO solo puede iniciarla para sí mismo; el ADMINISTRADOR indica el `socioId`.
 */
export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Token de autenticación inválido o faltante");
  }
  if (!user.rol || !ALLOWED_WRITE_ROLES.includes(user.rol)) {
    return errorResponse(403, "FORBIDDEN", MENSAJE_SIN_PERMISO);
  }

  let body: { socioId?: unknown; rutinaAsignadaId?: unknown };
  try {
    body = (await request.json()) as { socioId?: unknown; rutinaAsignadaId?: unknown };
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "Cuerpo de la solicitud inválido");
  }

  const rutinaAsignadaId =
    typeof body.rutinaAsignadaId === "string" ? body.rutinaAsignadaId : "";
  if (!rutinaAsignadaId) {
    return errorResponse(400, "VALIDATION_REQUIRED", "Se requiere el rutinaAsignadaId");
  }

  let socioId: string;
  if (user.rol === "SOCIO") {
    const propio = await resolveSocioIdDeUsuario(user.id);
    if (!propio) {
      return errorResponse(404, "SOCIO_NOT_FOUND", "No se encontró el perfil de socio");
    }
    if (typeof body.socioId === "string" && body.socioId && body.socioId !== propio) {
      return errorResponse(403, "FORBIDDEN", "No podés iniciar sesiones de otro socio");
    }
    socioId = propio;
  } else {
    if (typeof body.socioId !== "string" || !body.socioId) {
      return errorResponse(400, "VALIDATION_REQUIRED", "Se requiere el socioId");
    }
    socioId = body.socioId;
  }

  const { status, body: responseBody } = await handleIniciarSesionRequest({
    socioId,
    rutinaAsignadaId,
  });
  return NextResponse.json(responseBody, { status });
}

/**
 * GET /api/sesiones?enCurso=1 — sesión EN_CURSO del socio (o null).
 * Un SOCIO consulta la propia; el staff debe indicar `socioId`.
 */
export async function GET(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Token de autenticación inválido o faltante");
  }
  if (!user.rol || !ALLOWED_READ_ROLES.includes(user.rol)) {
    return errorResponse(403, "FORBIDDEN", "Se requiere rol de socio, administrador o instructor");
  }

  if (request.nextUrl.searchParams.get("enCurso") !== "1") {
    return errorResponse(400, "VALIDATION_REQUIRED", "Se requiere enCurso=1");
  }

  const socioIdParam = request.nextUrl.searchParams.get("socioId");
  let socioId: string;
  if (user.rol === "SOCIO") {
    const propio = await resolveSocioIdDeUsuario(user.id);
    if (!propio) {
      return errorResponse(404, "SOCIO_NOT_FOUND", "No se encontró el perfil de socio");
    }
    if (socioIdParam && socioIdParam !== propio) {
      return errorResponse(403, "FORBIDDEN", "No podés ver las sesiones de otro socio");
    }
    socioId = propio;
  } else {
    if (!socioIdParam) {
      return errorResponse(400, "VALIDATION_REQUIRED", "Se requiere el socioId");
    }
    socioId = socioIdParam;
  }

  const { status, body } = await handleSesionEnCursoRequest(socioId);
  return NextResponse.json(body, { status });
}
