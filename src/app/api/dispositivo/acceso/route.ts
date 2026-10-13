import { NextRequest, NextResponse } from "next/server";
import { handleCheckIn, type CheckInResultado } from "@/api/acceso";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { getTrustedClientIp } from "@/lib/client-ip";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import type { AccesoPuertaRespuesta } from "@/api/dispositivos";

const MAX_USER_AGENT = 255;

/**
 * Respuesta mínima de la puerta (D-43): sólo estado, nombre y motivo. Sin plan ni detalle de pago.
 * Reutiliza el resultado del check-in de T-035 y descarta el resto.
 */
export function aRespuestaPuerta(result: CheckInResultado): AccesoPuertaRespuesta {
  return {
    resultado: result.resultado,
    ...(result.motivo ? { motivo: result.motivo } : {}),
    ...(result.socio?.nombre ? { nombre: result.socio.nombre } : {}),
  };
}

/**
 * POST /api/dispositivo/acceso — check-in de la puerta por DNI + PIN.
 * NO usa sesión de usuario: el dispositivo se autentica con su token (`autenticarDispositivo`).
 * La lógica de decisión, el anti-passback, el límite de intentos y el registro de `Asistencia`
 * + `AuditoriaAcceso` son los mismos que en recepción (T-035); acá sólo se recorta la respuesta.
 */
export async function POST(request: NextRequest) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Dispositivo no autorizado" },
      { status: 401 }
    );
  }

  let body: { dni?: unknown; pin?: unknown };
  try {
    body = (await request.json()) as { dni?: unknown; pin?: unknown };
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  const dni = typeof body.dni === "string" ? body.dni.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!dni || !pin) {
    return NextResponse.json(
      { code: "VALIDATION_REQUIRED", message: "Se requieren el DNI y el PIN" },
      { status: 400 }
    );
  }

  const ip = getTrustedClientIp(request);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, MAX_USER_AGENT);

  try {
    const result = await handleCheckIn({ dni, pin, ip, userAgent });
    if (result.code === "RATE_LIMITED") {
      return NextResponse.json(
        { code: "RATE_LIMITED", message: result.motivo ?? "Demasiados intentos. Probá de nuevo en un minuto." },
        { status: 429 }
      );
    }

    return NextResponse.json(aRespuestaPuerta(result), { status: 200 });
  } catch (error) {
    // Mismo envelope de error que recepción: un fallo inesperado del check-in
    // no debe escapar como 500 crudo (AC-1).
    const mapped = mapErrorToResponse(error, { resourceName: "Socio" });
    return NextResponse.json(
      { code: mapped.code, message: mapped.message },
      { status: mapped.status }
    );
  }
}
