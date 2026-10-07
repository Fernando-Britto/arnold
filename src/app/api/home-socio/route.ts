import { NextRequest, NextResponse } from "next/server";
import { buildHomeSocioPayload } from "@/api/home-socio-data";
import { extractUserFromRequest } from "@/lib/auth";

/**
 * GET /api/home-socio
 * Datos de Home_Socio del socio que tiene la sesión. La identidad sale SIEMPRE de la cookie
 * (o Bearer), nunca de un parámetro, así que un socio no puede pedir los datos de otro.
 * El proxy ya filtra por rol; acá se repite la regla (defensa en profundidad): solo SOCIO.
 * `no-store`: la spec pide datos en vivo (aforo, sesión).
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
      { code: "FORBIDDEN", message: "Home_Socio es solo para socios" },
      { status: 403 }
    );
  }

  try {
    const payload = await buildHomeSocioPayload(user.id);
    if (!payload) {
      return NextResponse.json(
        { code: "SOCIO_NOT_FOUND", message: "No se encontró el perfil de socio" },
        { status: 404 }
      );
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/home-socio failed:", error); // el detalle queda en el log del servidor
    return NextResponse.json(
      { code: "HOME_SOCIO_ERROR", message: "No se pudo cargar tu inicio" },
      { status: 500 }
    );
  }
}
