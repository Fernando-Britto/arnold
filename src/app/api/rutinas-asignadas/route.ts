import { NextRequest, NextResponse } from "next/server";
import { handleAsignarRutina, handleListarRutinasDeSocio } from "@/api/rutinas-asignadas";
import type { AsignarRutinaInput } from "@/api/rutinas-asignadas";
import { EntidadNoEncontradaError } from "@/domains/rutina/asignar-rutina";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";

/** Roles que pueden asignar y consultar rutinas (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "INSTRUCTOR"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Nombre del recurso para el mensaje de un NOT_FOUND: permite distinguir "Socio"
 * de "Rutina" en el mismo endpoint (el mapper usa `resourceName` para el texto).
 */
function resourceNameDe(error: unknown): string {
  if (error instanceof EntidadNoEncontradaError) return error.entidad;
  const mensaje = error instanceof Error ? error.message : "";
  return /Rutina/.test(mensaje) ? "Rutina" : "Socio";
}

/**
 * Core handler logic for POST /api/rutinas-asignadas.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleAsignarRutinaRequest(body: AsignarRutinaInput): Promise<HandlerResult> {
  try {
    const rutinaAsignada = await handleAsignarRutina(body);
    return {
      status: 201,
      body: { success: true, message: "Rutina asignada", rutinaAsignada },
    };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
      resourceName: resourceNameDe(error),
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * Core handler logic for GET /api/rutinas-asignadas?socioId=.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleListarRutinasDeSocioRequest(socioId: string): Promise<HandlerResult> {
  try {
    const asignaciones = await handleListarRutinasDeSocio(socioId);
    return { status: 200, body: asignaciones };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
      resourceName: "Socio",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/rutinas-asignadas — asigna una rutina a un socio.
 * Requiere rol ADMINISTRADOR o INSTRUCTOR.
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
      { code: "FORBIDDEN", message: "Se requiere rol de administrador o instructor" },
      { status: 403 }
    );
  }

  let body: AsignarRutinaInput;
  try {
    body = (await request.json()) as AsignarRutinaInput;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  const { status, body: responseBody } = await handleAsignarRutinaRequest(body);
  return NextResponse.json(responseBody, { status });
}

/**
 * GET /api/rutinas-asignadas?socioId= — asignaciones de un socio.
 * Requiere rol ADMINISTRADOR o INSTRUCTOR.
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
      { code: "FORBIDDEN", message: "Se requiere rol de administrador o instructor" },
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

  const { status, body } = await handleListarRutinasDeSocioRequest(socioId);
  return NextResponse.json(body, { status });
}
