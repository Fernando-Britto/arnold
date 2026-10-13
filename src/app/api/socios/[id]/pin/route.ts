import { NextRequest, NextResponse } from "next/server";
import { handleSetPin } from "@/api/acceso";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** Roles que pueden definir el PIN de un socio (D-47): Administrador y Recepcionista. */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for POST /api/socios/{id}/pin.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleSetPinRequest(socioId: string, body: unknown): Promise<HandlerResult> {
  try {
    const result = await handleSetPin(socioId, (body as { pin?: unknown })?.pin);
    return { status: 200, body: result };
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/socios/{id}/pin — define el PIN de 4 dígitos del socio (hasheado, nunca se devuelve).
 * Requiere rol ADMINISTRADOR o RECEPCIONISTA.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
      { status: 401 }
    );
  }
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Se requiere rol de administrador o recepcionista" },
      { status: 403 }
    );
  }

  const { id: socioId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  const { status, body: responseBody } = await handleSetPinRequest(socioId, body);
  return NextResponse.json(responseBody, { status });
}
