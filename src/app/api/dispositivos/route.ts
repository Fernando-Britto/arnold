import { NextRequest, NextResponse } from "next/server";
import { handleDispositivoCreate, handleDispositivoList } from "@/api/dispositivos";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** Alta y listado de dispositivos: solo Administrador (D-43 propuesta 4). */
const ALLOWED_ROLES = ["ADMINISTRADOR"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for POST /api/dispositivos.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleDispositivoCreateRequest(body: unknown): Promise<HandlerResult> {
  try {
    const result = await handleDispositivoCreate(body as { nombre: unknown; tipo?: unknown });
    return { status: 201, body: result };
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Dispositivo" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * Core handler logic for GET /api/dispositivos.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleDispositivoListRequest(): Promise<HandlerResult> {
  try {
    const dispositivos = await handleDispositivoList();
    return { status: 200, body: dispositivos };
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Dispositivo" });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

function unauthorized() {
  return NextResponse.json(
    { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
    { status: 401 }
  );
}

function forbidden() {
  return NextResponse.json(
    { code: "FORBIDDEN", message: "Se requiere rol de administrador" },
    { status: 403 }
  );
}

/**
 * POST /api/dispositivos — crea un dispositivo y devuelve su token en claro UNA sola vez.
 * Requiere rol ADMINISTRADOR.
 */
export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) return unauthorized();
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) return forbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  const { status, body: responseBody } = await handleDispositivoCreateRequest(body);
  return NextResponse.json(responseBody, { status });
}

/**
 * GET /api/dispositivos — lista dispositivos SIN token ni hash. Requiere rol ADMINISTRADOR.
 */
export async function GET(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) return unauthorized();
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) return forbidden();

  const { status, body } = await handleDispositivoListRequest();
  return NextResponse.json(body, { status });
}
