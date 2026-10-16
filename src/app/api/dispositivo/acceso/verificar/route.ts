import { NextRequest, NextResponse } from "next/server";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { handleAccesoPorHuella } from "@/api/huellas";
import { getTrustedClientIp } from "@/lib/client-ip";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

const MAX_USER_AGENT = 255;

/**
 * POST /api/dispositivo/acceso/verificar — acceso por huella (D-47). NO usa sesión de usuario: el
 * dispositivo se autentica con su token. Body `{ huellaId, confianza }` → `{ autorizado, nombre?, motivo? }`.
 */
export async function POST(request: NextRequest) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Dispositivo no autorizado" },
      { status: 401 }
    );
  }

  let body: { huellaId?: unknown; confianza?: unknown };
  try {
    body = (await request.json()) as { huellaId?: unknown; confianza?: unknown };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  if (typeof body.huellaId !== "number" || typeof body.confianza !== "number") {
    return NextResponse.json(
      { code: "VALIDATION_REQUIRED", message: "Se requieren huellaId y confianza" },
      { status: 400 }
    );
  }

  const ip = getTrustedClientIp(request);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, MAX_USER_AGENT);

  try {
    const resultado = await handleAccesoPorHuella({
      huellaId: body.huellaId,
      confianza: body.confianza,
      ip,
      userAgent,
    });
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return NextResponse.json(
      { code: mapped.code, message: mapped.message },
      { status: mapped.status }
    );
  }
}
