import { NextRequest, NextResponse } from "next/server";
import {
  handleFinalizarSesion,
  handleObtenerSesion,
  resolveSocioIdDeUsuario,
} from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** Roles que pueden finalizar sesiones: el SOCIO (las propias) y el ADMINISTRADOR (D-44). */
const ALLOWED_WRITE_ROLES = ["SOCIO", "ADMINISTRADOR"];

const MENSAJE_SIN_PERMISO = "Se requiere rol de socio o administrador";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * PUT /api/sesiones/[id] — finaliza una sesión de entrenamiento.
 * Un SOCIO solo finaliza sus propias sesiones; el ADMINISTRADOR, cualquiera. INSTRUCTOR solo lee.
 * `params` es una promesa en Next 16 (FX-06): hay que await-earla.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "Token de autenticación inválido o faltante");
  }
  if (!user.rol || !ALLOWED_WRITE_ROLES.includes(user.rol)) {
    return errorResponse(403, "FORBIDDEN", MENSAJE_SIN_PERMISO);
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
        return errorResponse(403, "FORBIDDEN", "No podés finalizar la sesión de otro socio");
      }
    }

    const resultado = await handleFinalizarSesion({ sesionId });
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Sesión" });
    return NextResponse.json({ code: mapped.code, message: mapped.message }, { status: mapped.status });
  }
}
