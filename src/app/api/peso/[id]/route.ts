import { NextRequest, NextResponse } from "next/server";
import { handleEliminarPeso } from "@/api/peso";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * DELETE /api/peso/[id] — el socio borra un pesaje propio (P-47, D-65).
 * El socio sale SIEMPRE del token y filtra el delete: un id ajeno responde 404, igual que uno
 * inexistente. No se puede borrar el peso de otro ni distinguir si existe.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Token de autenticación inválido o faltante");
  }
  if (user.rol !== "SOCIO") {
    return errorResponse(403, "FORBIDDEN", "Solo el socio borra sus propios pesajes");
  }

  try {
    const socioId = await resolveSocioIdDeUsuario(user.id);
    if (!socioId) {
      return errorResponse(404, "SOCIO_NOT_FOUND", "No se encontró el perfil de socio");
    }

    const { id } = await params;
    await handleEliminarPeso({ socioId, id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Pesaje" });
    return NextResponse.json({ code: mapped.code, message: mapped.message }, { status: mapped.status });
  }
}
