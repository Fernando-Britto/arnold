import { NextRequest, NextResponse } from "next/server";
import { handleBuscarSocioPorId } from "@/api/socios";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";

/** Mismos roles que la búsqueda por DNI: cobrar y ubicar al socio (N1). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for GET /api/socios/[id].
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleBuscarSocioPorIdRequest(id: string): Promise<HandlerResult> {
  try {
    const socio = await handleBuscarSocioPorId(id);
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
 * GET /api/socios/[id] — vista previa de cobro de un socio por id.
 * Requiere rol ADMINISTRADOR, RECEPCIONISTA o INSTRUCTOR. Solo lectura.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      { code: "FORBIDDEN", message: "Se requiere rol de administrador, recepcionista o instructor" },
      { status: 403 }
    );
  }

  // Await params per Next.js 16 App Router spec.
  const { id } = await params;
  const { status, body } = await handleBuscarSocioPorIdRequest(id);
  return NextResponse.json(body, { status });
}
