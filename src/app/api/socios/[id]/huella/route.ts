import { NextRequest, NextResponse } from "next/server";
import { estadoHuella, solicitarBaja, solicitarEnrolamiento } from "@/api/huellas";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** Roles que pueden registrar o borrar la huella de un socio: Administrador y Recepcionista. */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for POST /api/socios/{id}/huella.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleHuellaPostRequest(socioId: string, body: unknown): Promise<HandlerResult> {
  const input = (body ?? {}) as { accion?: unknown; consentimiento?: unknown };
  try {
    if (input.accion === "enrolar") {
      const solicitud = await solicitarEnrolamiento(socioId, { consentimiento: input.consentimiento });
      return { status: 200, body: solicitud };
    }
    if (input.accion === "borrar") {
      const solicitud = await solicitarBaja(socioId);
      return { status: 200, body: solicitud };
    }
    return {
      status: 400,
      body: { code: "VALIDATION_ERROR", message: "Acción inválida: se espera 'enrolar' o 'borrar'" },
    };
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * Core handler logic for GET /api/socios/{id}/huella.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleHuellaGetRequest(socioId: string): Promise<HandlerResult> {
  try {
    return { status: 200, body: await estadoHuella(socioId) };
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/socios/{id}/huella — encola el enrolamiento o la baja de la huella del socio.
 * Requiere rol ADMINISTRADOR o RECEPCIONISTA. Body `{ accion: "enrolar" | "borrar", consentimiento? }`.
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

  const { status, body: responseBody } = await handleHuellaPostRequest(socioId, body);

  // La operación sobre la huella queda auditada sólo en el éxito; nunca se guardan plantillas.
  if (status === 200) {
    await registrarOperacion({
      tipoOperacion: "MODIFICACION",
      responsableId: user.id,
      detalles: { socioId, campo: "huella" },
    });
  }

  return NextResponse.json(responseBody, { status });
}

/**
 * GET /api/socios/{id}/huella — estado de la huella del socio y su solicitud más reciente.
 * Requiere rol ADMINISTRADOR o RECEPCIONISTA.
 */
export async function GET(
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
  const { status, body } = await handleHuellaGetRequest(socioId);
  return NextResponse.json(body, { status });
}
