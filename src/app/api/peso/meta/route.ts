import { NextRequest, NextResponse } from "next/server";
import { handleFijarMeta } from "@/api/peso";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * PUT /api/peso/meta — el socio fija o borra su meta de peso (T-048, D-65).
 * Para borrarla hay que mandar `pesoObjetivo: null` a propósito: si el campo falta es un error,
 * porque un cuerpo vacío no debería borrar la meta de nadie. Como en `POST /api/peso`, el socio
 * sale del token.
 */
export async function PUT(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Token de autenticación inválido o faltante");
  }
  if (user.rol !== "SOCIO") {
    return errorResponse(403, "FORBIDDEN", "Solo el socio fija su propia meta de peso");
  }

  try {
    const socioId = await resolveSocioIdDeUsuario(user.id);
    if (!socioId) {
      return errorResponse(404, "SOCIO_NOT_FOUND", "No se encontró el perfil de socio");
    }

    let body: Record<string, unknown> | null;
    try {
      body = (await request.json()) as Record<string, unknown> | null;
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "Cuerpo de la solicitud inválido");
    }
    if (!body || typeof body !== "object" || !("pesoObjetivo" in body)) {
      return errorResponse(
        400,
        "VALIDATION_REQUIRED",
        "Se requiere pesoObjetivo (un número, o null para borrar la meta)"
      );
    }

    const meta = await handleFijarMeta({ socioId, pesoObjetivo: body.pesoObjetivo });
    return NextResponse.json(meta, { status: 200 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return NextResponse.json({ code: mapped.code, message: mapped.message }, { status: mapped.status });
  }
}
