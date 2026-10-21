import { NextRequest, NextResponse } from "next/server";
import {
  handleObtenerSesion,
  handleRegistrarSerie,
  resolveSocioIdDeUsuario,
} from "@/api/sesiones";
import type { DropDeSerie } from "@/domains/sesion/sesion-de-entrenamiento";
import { esTipoSerie, type TipoSerie } from "@/domains/sesion/tipo-serie";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** Roles que pueden registrar series: el SOCIO (en sus sesiones) y el ADMINISTRADOR (D-44). */
const ALLOWED_WRITE_ROLES = ["SOCIO", "ADMINISTRADOR"];

const MENSAJE_SIN_PERMISO = "Se requiere rol de socio o administrador";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

/**
 * POST /api/sesiones/[id]/series — registra una serie de la sesión (D-48).
 * Un SOCIO solo registra en sus propias sesiones; el ADMINISTRADOR, en cualquiera.
 * `params` es una promesa en Next 16 (FX-06).
 */
export async function POST(
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
        return errorResponse(403, "FORBIDDEN", "No podés registrar series en la sesión de otro socio");
      }
    }

    let body: {
      ejercicioId?: unknown;
      carga?: unknown;
      repeticiones?: unknown;
      rir?: unknown;
      tipo?: unknown;
      drops?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "Cuerpo de la solicitud inválido");
    }

    const ejercicioId = typeof body.ejercicioId === "string" ? body.ejercicioId : "";
    if (!ejercicioId || typeof body.carga !== "number" || typeof body.repeticiones !== "number") {
      return errorResponse(
        400,
        "VALIDATION_REQUIRED",
        "Se requieren ejercicioId, carga y repeticiones"
      );
    }

    // SE-5: un `rir` presente pero no numérico es un error de validación (400),
    // no un valor que se coaccione silenciosamente a null.
    let rir: number | null = null;
    if (body.rir !== undefined) {
      if (typeof body.rir !== "number" || Number.isNaN(body.rir)) {
        return errorResponse(400, "VALIDATION_ERROR", "El RIR debe ser un número");
      }
      rir = body.rir;
    }

    // D-64: igual que el RIR, un `tipo` presente pero inválido es un error (400): no se ignora
    // en silencio, porque guardar un calentamiento como serie normal ensuciaría la progresión.
    let tipo: TipoSerie | undefined;
    if (body.tipo !== undefined) {
      if (!esTipoSerie(body.tipo)) {
        return errorResponse(400, "VALIDATION_ERROR", "El tipo de serie no es válido");
      }
      tipo = body.tipo;
    }

    const resultado = await handleRegistrarSerie({
      sesionId,
      ejercicioId,
      carga: body.carga,
      repeticiones: body.repeticiones,
      rir,
      ...(tipo ? { tipo } : {}),
      // P-46, D-69: los drop sets los valida el dominio (forma, cantidad, valores) antes de tocar la base.
      ...(body.drops !== undefined ? { drops: body.drops as DropDeSerie[] } : {}),
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Sesión" });
    return NextResponse.json({ code: mapped.code, message: mapped.message }, { status: mapped.status });
  }
}
