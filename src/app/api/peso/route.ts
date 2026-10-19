import { NextRequest, NextResponse } from "next/server";
import { handleRegistrarPeso } from "@/api/peso";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * POST /api/peso — el socio registra un pesaje propio (T-048, D-65).
 * El peso es del socio y lo registra el socio: el socio sale SIEMPRE del token, nunca del
 * cuerpo, así no se puede pesar a otro. El rango y el tipo del peso los valida el dominio.
 */
export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Token de autenticación inválido o faltante");
  }
  if (user.rol !== "SOCIO") {
    return errorResponse(403, "FORBIDDEN", "Solo el socio registra su propio peso");
  }

  try {
    const socioId = await resolveSocioIdDeUsuario(user.id);
    if (!socioId) {
      return errorResponse(404, "SOCIO_NOT_FOUND", "No se encontró el perfil de socio");
    }

    let body: { peso?: unknown } | null;
    try {
      body = (await request.json()) as { peso?: unknown } | null;
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "Cuerpo de la solicitud inválido");
    }

    const pesaje = await handleRegistrarPeso({ socioId, peso: body?.peso });
    return NextResponse.json(pesaje, { status: 201 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return NextResponse.json({ code: mapped.code, message: mapped.message }, { status: mapped.status });
  }
}
