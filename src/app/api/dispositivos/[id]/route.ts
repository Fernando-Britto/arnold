import { NextRequest, NextResponse } from "next/server";
import { handleDispositivoEstado } from "@/api/dispositivos";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { registrarOperacion } from "@/lib/audit";
import { readJsonBody } from "@/lib/request-body";

/**
 * PUT /api/dispositivos/[id] — cambia el estado del dispositivo (ACTIVO/INACTIVO), sólo
 * Administrador. Se eligió el patrón de item `[id]` con PUT porque es la convención de la casa
 * para actualizar un recurso (membresias/[id], clientes/[id], rutinas/[id]): el `[id]` en la URL
 * identifica el recurso y PUT envía el cambio. Desactivar (INACTIVO) revoca el token del
 * dispositivo (AC-10).
 */
const ALLOWED_ROLES = ["ADMINISTRADOR"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for PUT /api/dispositivos/[id].
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleDispositivoEstadoRequest(
  id: string,
  body: unknown
): Promise<HandlerResult> {
  try {
    const estado = (body as { estado?: unknown } | null)?.estado;
    const dispositivo = await handleDispositivoEstado(id, estado);
    return { status: 200, body: dispositivo };
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
 * PUT /api/dispositivos/[id] — activa o desactiva un dispositivo. Requiere rol ADMINISTRADOR.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = extractUserFromRequest(request);
  if (!user) return unauthorized();
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) return forbidden();

  const parsed = await readJsonBody<{ estado?: unknown }>(request);
  if (!parsed.ok) return parsed.response;

  const id = (await params).id;
  const { status, body } = await handleDispositivoEstadoRequest(id, parsed.body);

  if (status === 200) {
    // Auditoría best-effort: no altera la respuesta HTTP.
    await registrarOperacion({
      tipoOperacion: "MODIFICACION",
      responsableId: user.id,
      detalles: { dispositivoId: id, estado: (body as { estado?: string }).estado },
    });
  }

  return NextResponse.json(body, { status });
}
