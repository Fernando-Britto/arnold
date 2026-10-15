import { NextRequest, NextResponse } from "next/server";
import { handleBuscarSocio } from "@/api/socios";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";

/** Roles que pueden buscar socios: cobrar (D-42) y asignar rutina (el Instructor ubica al socio; N1). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for GET /api/socios?dni=.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleBuscarSocioRequest(dni: string): Promise<HandlerResult> {
  try {
    const socio = await handleBuscarSocio(dni);
    return { status: 200, body: socio };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador, recepcionista o instructor",
      resourceName: "Socio",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * GET /api/socios?dni= — busca un socio por DNI con estado de cuota y plan de pago.
 * Requiere rol ADMINISTRADOR, RECEPCIONISTA o INSTRUCTOR. Solo lectura.
 */
export async function GET(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
      { status: 401 }
    );
  }
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Se requiere rol de administrador, recepcionista o instructor" },
      { status: 403 }
    );
  }

  const dni = request.nextUrl.searchParams.get("dni");
  if (!dni) {
    return NextResponse.json(
      { code: "VALIDATION_REQUIRED", message: "Se requiere el parámetro dni" },
      { status: 400 }
    );
  }

  const { status, body } = await handleBuscarSocioRequest(dni);
  return NextResponse.json(body, { status });
}
