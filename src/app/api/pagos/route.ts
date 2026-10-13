import { NextRequest, NextResponse } from "next/server";
import { handleRegistrarPago, handleListarPagos } from "@/api/pagos";
import type { RegistrarPagoInput } from "@/domains/pago/registrar-pago";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { readJsonBody } from "@/lib/request-body";
import { extractUserFromRequest } from "@/lib/auth";

/** Roles que pueden registrar y consultar pagos (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for POST /api/pagos.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleRegistrarPagoRequest(body: RegistrarPagoInput): Promise<HandlerResult> {
  try {
    const result = await handleRegistrarPago(body);
    return { status: 201, body: result };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Socio",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * Core handler logic for GET /api/pagos?socioId=.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleListarPagosRequest(socioId: string): Promise<HandlerResult> {
  try {
    const pagos = await handleListarPagos(socioId);
    return { status: 200, body: pagos };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Socio",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/pagos — registra un pago mensual.
 * Requiere rol ADMINISTRADOR o RECEPCIONISTA.
 */
export async function POST(request: NextRequest) {
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

  const parsed = await readJsonBody<RegistrarPagoInput>(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.body;
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    typeof body.socioId !== "string" ||
    body.socioId.trim() === ""
  ) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "El socio es requerido" },
      { status: 400 }
    );
  }

  const { status, body: responseBody } = await handleRegistrarPagoRequest(body);
  return NextResponse.json(responseBody, { status });
}

/**
 * GET /api/pagos?socioId= — historial de pagos de un socio.
 * Requiere rol ADMINISTRADOR o RECEPCIONISTA.
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
      { code: "FORBIDDEN", message: "Se requiere rol de administrador o recepcionista" },
      { status: 403 }
    );
  }

  const socioId = request.nextUrl.searchParams.get("socioId");
  if (!socioId) {
    return NextResponse.json(
      { code: "VALIDATION_REQUIRED", message: "Se requiere el parámetro socioId" },
      { status: 400 }
    );
  }

  const { status, body } = await handleListarPagosRequest(socioId);
  return NextResponse.json(body, { status });
}
