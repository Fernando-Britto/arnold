import { NextRequest, NextResponse } from "next/server";
import {
  handleObtenerSesion,
  handleResumenSesion,
  resolveSocioIdDeUsuario,
} from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** Roles que pueden leer sesiones: el SOCIO (las propias) y el staff (D-44). */
const ALLOWED_READ_ROLES = ["SOCIO", "ADMINISTRADOR", "INSTRUCTOR"];

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * GET /api/sesiones/[id]/resumen — resumen de una sesión de entrenamiento (T-046b, D-62): por
 * ejercicio, lo de hoy contra la última vez y la carga que se sugiere para la próxima sesión.
 * Un SOCIO solo lee el resumen de sus propias sesiones; el staff, el de cualquiera.
 * `params` es una promesa en Next 16 (FX-06): hay que await-earla.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Token de autenticación inválido o faltante");
  }
  if (!user.rol || !ALLOWED_READ_ROLES.includes(user.rol)) {
    return errorResponse(403, "FORBIDDEN", "No tenés permiso para ver sesiones");
  }

  const { id: sesionId } = await params;

  try {
    const sesion = await handleObtenerSesion(sesionId);
    if (!sesion) {
      return errorResponse(404, "NOT_FOUND", "Sesión no encontrada");
    }

    if (user.rol === "SOCIO") {
      const propio = await resolveSocioIdDeUsuario(user.id);
      if (!propio) {
        return errorResponse(404, "SOCIO_NOT_FOUND", "No se encontró el perfil de socio");
      }
      if ((sesion as { socioId: string }).socioId !== propio) {
        return errorResponse(403, "FORBIDDEN", "No podés ver la sesión de otro socio");
      }
    }

    return NextResponse.json(await handleResumenSesion(sesionId), { status: 200 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Sesión" });
    return NextResponse.json({ code: mapped.code, message: mapped.message }, { status: mapped.status });
  }
}
