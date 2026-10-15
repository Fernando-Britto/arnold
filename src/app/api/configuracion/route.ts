import { NextRequest, NextResponse } from "next/server";
import { getConfiguracion, actualizarConfiguracion, type Configuracion } from "@/lib/configuracion";
import { validarCambiosConfiguracion } from "@/domains/configuracion/configuracion";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { readJsonBody } from "@/lib/request-body";
import { extractUserFromRequest } from "@/lib/auth";
import type { UserRole } from "@/lib/authorization";

/** Panel de parámetros del sistema: solo Administrador (D-54 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR"];

interface HandlerResult {
  status: number;
  body: unknown;
}

const ERROR_OPTIONS = {
  forbiddenMessage: "Se requiere rol de administrador",
  resourceName: "Configuración",
};

/**
 * Core handler logic for GET /api/configuracion.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleObtenerConfiguracionRequest(): Promise<HandlerResult> {
  try {
    const config = await getConfiguracion();
    return { status: 200, body: config };
  } catch (error) {
    const mapped = mapErrorToResponse(error, ERROR_OPTIONS);
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * Core handler logic for PUT /api/configuracion.
 * Exportado para testear sin mockear NextRequest/NextResponse. La auditoría la escribe
 * `actualizarConfiguracion` dentro de su transacción (D-54): acá no se registra nada.
 */
export async function handleActualizarConfiguracionRequest(
  body: unknown,
  responsableId: string,
): Promise<HandlerResult> {
  const validado = validarCambiosConfiguracion(body);
  if (!validado.ok) {
    return { status: 400, body: { code: "VALIDATION_ERROR", message: validado.message } };
  }

  try {
    const config = await actualizarConfiguracion(
      validado.cambios as Partial<Configuracion>,
      responsableId,
    );
    return { status: 200, body: config };
  } catch (error) {
    const mapped = mapErrorToResponse(error, ERROR_OPTIONS);
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/** Sesión válida y rol ADMINISTRADOR, o la respuesta 401/403 ya lista. */
type Autorizacion =
  | { user: { id: string; rol?: UserRole } }
  | { response: NextResponse };

function autorizar(request: NextRequest): Autorizacion {
  const user = extractUserFromRequest(request);
  if (!user) {
    return {
      response: NextResponse.json(
        { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
        { status: 401 }
      ),
    };
  }
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return {
      response: NextResponse.json(
        { code: "FORBIDDEN", message: "Se requiere rol de administrador" },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/**
 * GET /api/configuracion — parámetros actuales.
 * Requiere rol ADMINISTRADOR.
 */
export async function GET(request: NextRequest) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const { status, body } = await handleObtenerConfiguracionRequest();
  return NextResponse.json(body, { status });
}

/**
 * PUT /api/configuracion — actualiza los parámetros enviados.
 * Requiere rol ADMINISTRADOR.
 */
export async function PUT(request: NextRequest) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const { status, body } = await handleActualizarConfiguracionRequest(parsed.body, auth.user.id);
  return NextResponse.json(body, { status });
}
