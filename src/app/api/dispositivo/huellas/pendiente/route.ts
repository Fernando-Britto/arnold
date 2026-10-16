import { NextRequest, NextResponse } from "next/server";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { tomarSolicitudPendiente } from "@/api/huellas";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * GET /api/dispositivo/huellas/pendiente — cola de enrolamientos/bajas que el sensor consulta por
 * polling. NO usa sesión de usuario: el dispositivo se autentica con su token.
 * Devuelve `{ accion: "enrolar" | "borrar" | null, huellaId? }`.
 */
export async function GET(request: NextRequest) {
  const dispositivo = await autenticarDispositivo(request);
  if (!dispositivo) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Dispositivo no autorizado" },
      { status: 401 }
    );
  }

  try {
    const solicitud = await tomarSolicitudPendiente();
    return NextResponse.json(solicitud, { status: 200 });
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Solicitud" });
    return NextResponse.json(
      { code: mapped.code, message: mapped.message },
      { status: mapped.status }
    );
  }
}
