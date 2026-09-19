import { NextRequest, NextResponse } from "next/server";
import { handleAccessOverride } from "@/api/socios/access-override";
import { extractUserFromAuthHeader, RequestWithUser } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Core handler logic for POST /api/socios/{id}/access-override
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns { code, message, status } or { success, message }
 */
export async function handleAccessOverrideRequest(
  authHeader: string | undefined,
  body: any,
  socioId: string
): Promise<{
  code?: string;
  message: string;
  status: number;
  success?: boolean;
}> {
  try {
    // Extract user from Authorization header
    const user = extractUserFromAuthHeader(authHeader);

    // Require valid authentication
    if (!user) {
      return {
        code: "UNAUTHORIZED",
        message: "Token de autenticación inválido o faltante",
        status: 401,
      };
    }

    // Create RequestWithUser with real user from JWT
    const req: RequestWithUser = {
      user: {
        id: user.id,
        rol: user.rol || "UNKNOWN",
        email: "",
        nombre: "",
      },
      body,
      ip: "0.0.0.0",
      headers: {},
    } as any;

    const result = await handleAccessOverride(req, socioId);

    return {
      ...result,
      status: 200,
    };
  } catch (error) {
    const mapped = mapErrorToResponse(error);
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * POST /api/socios/{id}/access-override
 * Grant access override with mandatory reason and audit trail
 * Requires ADMINISTRADOR role
 * Spec: manual-override-authorization/spec.md
 *
 * Auth: Bearer token in Authorization header
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params per Next.js 16 App Router spec
  const { id: socioId } = await params;

  const authHeader = request.headers.get("Authorization") || undefined;
  const body = await request.json();

  const result = await handleAccessOverrideRequest(authHeader, body, socioId);

  return NextResponse.json(
    { code: result.code, message: result.message, success: result.success },
    { status: result.status }
  );
}
