import { NextRequest, NextResponse } from "next/server";
import { handleCheckIn, type CheckInInput } from "@/api/acceso";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { getTrustedClientIp } from "@/lib/client-ip";

/** Roles que operan el kiosco de recepción (D-47): Administrador y Recepcionista. */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];
const MAX_USER_AGENT = 255;

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for POST /api/acceso/check-in.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleCheckInRequest(input: CheckInInput): Promise<HandlerResult> {
  try {
    const result = await handleCheckIn(input);
    if (result.code === "RATE_LIMITED") {
      return {
        status: 429,
        body: { code: "RATE_LIMITED", message: result.motivo ?? "Demasiados intentos. Probá de nuevo en un minuto." },
      };
    }
    return { status: 200, body: result };
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/acceso/check-in — ingreso por DNI + PIN desde recepción.
 * Requiere rol ADMINISTRADOR o RECEPCIONISTA. El límite de intentos por IP va en el servicio.
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

  let body: { dni?: unknown; pin?: unknown };
  try {
    body = (await request.json()) as { dni?: unknown; pin?: unknown };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  const dni = typeof body.dni === "string" ? body.dni.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!dni || !pin) {
    return NextResponse.json(
      { code: "VALIDATION_REQUIRED", message: "Se requieren el DNI y el PIN" },
      { status: 400 }
    );
  }

  const ip = getTrustedClientIp(request);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, MAX_USER_AGENT);

  const { status, body: responseBody } = await handleCheckInRequest({ dni, pin, ip, userAgent });
  return NextResponse.json(responseBody, { status });
}
