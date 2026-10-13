import { NextRequest, NextResponse } from "next/server";
import { buildHomeSocioSeccionesPayload } from "@/api/home-socio-secciones-data";
import { extractUserFromRequest } from "@/lib/auth";

/**
 * GET /api/home-socio/secciones
 * Datos de las secciones del socio (Mi rutina, Mis ejercicios, Progreso, Mis pagos y
 * membresía, Mis asistencias). La identidad sale SIEMPRE de la cookie (o Bearer), nunca de
 * un parámetro: un socio no puede pedir los datos de otro. Cuelga de `/api/home-socio`, así
 * que la entrada de autorización ya existente cubre la ruta; acá se repite la regla (solo SOCIO).
 * `no-store`: la spec pide datos en vivo (progreso, asistencias, pagos).
 */
export async function GET(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
      { status: 401 }
    );
  }
  if (user.rol !== "SOCIO") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Las secciones del socio son solo para socios" },
      { status: 403 }
    );
  }

  try {
    const payload = await buildHomeSocioSeccionesPayload(user.id);
    if (!payload) {
      return NextResponse.json(
        { code: "SOCIO_NOT_FOUND", message: "No se encontró el perfil de socio" },
        { status: 404 }
      );
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/home-socio/secciones failed:", error); // el detalle queda en el log
    return NextResponse.json(
      { code: "HOME_SOCIO_SECCIONES_ERROR", message: "No se pudieron cargar tus secciones" },
      { status: 500 }
    );
  }
}
