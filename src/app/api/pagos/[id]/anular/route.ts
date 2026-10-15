import { NextRequest, NextResponse } from "next/server";
import { handleAnularPago } from "@/api/pagos";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { readJsonBody } from "@/lib/request-body";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";

/** Roles que pueden anular un pago (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for POST /api/pagos/{id}/anular.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleAnularPagoRequest(
  pagoId: string,
  motivo: string
): Promise<HandlerResult> {
  try {
    const result = await handleAnularPago({ pagoId, motivo });
    return { status: 200, body: result };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Pago",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/pagos/{id}/anular — anula un pago (P-39). Requiere rol ADMINISTRADOR o
 * RECEPCIONISTA y un motivo obligatorio.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pagoId } = await params;

  const user = extractUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
      { status: 401 }
    );
  }
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Se requiere rol de administrador o recepcionista" },
      { status: 403 }
    );
  }

  const parsed = await readJsonBody<{ motivo?: unknown }>(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.body;
  const motivo =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { motivo?: unknown }).motivo
      : undefined;
  if (typeof motivo !== "string" || motivo.trim() === "") {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "El motivo es requerido" },
      { status: 400 }
    );
  }

  const { status, body: responseBody } = await handleAnularPagoRequest(pagoId, motivo);
  if (status === 200) {
    // Auditoría best-effort: no altera la respuesta HTTP. `cuotaId` se toma del pago o de la
    // cuota borrada: al borrarla, `Pago.cuotaId` queda en null (onDelete: SetNull) y el rastro
    // se perdería si solo se leyera el pago re-leído.
    const pago = (responseBody as {
      pago?: { socioId?: string | null; cuotaId?: string | null } | null;
      cuotaEliminada?: string | null;
    } | null)?.pago;
    const cuotaEliminada =
      (responseBody as { cuotaEliminada?: string | null } | null)?.cuotaEliminada ?? null;
    await registrarOperacion({
      tipoOperacion: "ANULACION",
      responsableId: user.id,
      detalles: {
        pagoId,
        socioId: pago?.socioId ?? null,
        cuotaId: cuotaEliminada ?? pago?.cuotaId ?? null,
        motivo,
      },
    });
  }
  return NextResponse.json(responseBody, { status });
}
