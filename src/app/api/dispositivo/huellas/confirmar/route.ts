import { NextRequest, NextResponse } from "next/server";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { confirmarSolicitud, type AccionHuellaDispositivo } from "@/api/huellas";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

const ACCIONES_VALIDAS: readonly AccionHuellaDispositivo[] = ["enrolar", "borrar"];

/**
 * POST /api/dispositivo/huellas/confirmar — el sensor reporta el resultado de una solicitud
 * (enrolar/borrar, ok o falla). NO usa sesión de usuario: se autentica por token de dispositivo.
 * Body: `{ huellaId, accion: "enrolar" | "borrar", ok, motivo?, duplicadoDe? }` → `200 { ok: true }`.
 */
export async function POST(request: NextRequest) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Dispositivo no autorizado" },
      { status: 401 }
    );
  }

  let body: {
    huellaId?: unknown;
    accion?: unknown;
    ok?: unknown;
    motivo?: unknown;
    duplicadoDe?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  const huellaId = typeof body.huellaId === "number" ? body.huellaId : null;
  const accion =
    typeof body.accion === "string" && ACCIONES_VALIDAS.includes(body.accion as AccionHuellaDispositivo)
      ? (body.accion as AccionHuellaDispositivo)
      : null;
  if (huellaId === null || accion === null || typeof body.ok !== "boolean") {
    return NextResponse.json(
      { code: "VALIDATION_REQUIRED", message: "Se requieren huellaId, accion y ok" },
      { status: 400 }
    );
  }

  try {
    await confirmarSolicitud({
      huellaId,
      accion,
      ok: body.ok,
      motivo: typeof body.motivo === "string" ? body.motivo : undefined,
      duplicadoDe: typeof body.duplicadoDe === "number" ? body.duplicadoDe : undefined,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Solicitud" });
    return NextResponse.json(
      { code: mapped.code, message: mapped.message },
      { status: mapped.status }
    );
  }
}
