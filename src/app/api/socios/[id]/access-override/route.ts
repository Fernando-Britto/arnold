import { NextRequest, NextResponse } from "next/server";
import { handleAccessOverride } from "@/api/socios/access-override";
import { extractUserFromAuthHeader, RequestWithUser } from "@/lib/auth";

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
  try {
    // Await params per Next.js 16 App Router spec
    const { id: socioId } = await params;

    // Extract user from Authorization header
    const authHeader = request.headers.get("Authorization");
    const user = extractUserFromAuthHeader(authHeader || undefined);

    // Require valid authentication
    if (!user) {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Token de autenticación inválido o faltante",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Create RequestWithUser with real user from JWT
    const req: RequestWithUser = {
      user: {
        id: user.id,
        rol: user.rol || "UNKNOWN",
        email: "", // Not in JWT yet, can be added later
        nombre: "", // Not in JWT yet, can be added later
      },
      body,
      ip: request.headers.get("x-forwarded-for") || "0.0.0.0",
      headers: Object.fromEntries(request.headers),
    } as any;

    const result = await handleAccessOverride(req, socioId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Map error messages to HTTP status codes per spec
    if (message.includes("Validación fallida")) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: message.replace("Validación fallida: ", ""),
        },
        { status: 400 }
      );
    }

    if (message.includes("FORBIDDEN")) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "Se requiere rol de administrador",
        },
        { status: 403 }
      );
    }

    if (message.includes("NOT_FOUND")) {
      return NextResponse.json(
        {
          code: "NOT_FOUND",
          message: "Socio no encontrado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        code: "SERVER_ERROR",
        message: "No se pudo procesar el override",
      },
      { status: 500 }
    );
  }
}
