import { NextRequest, NextResponse } from "next/server";
import { handleBalanceMuscular } from "@/api/balance-muscular";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { esPeriodo } from "@/domains/ejercicio/balance-muscular";
import { extractUserFromRequest } from "@/lib/auth";

/**
 * GET /api/home-socio/musculos?periodo=semana|30d|90d|todo
 * Balance muscular del PROPIO socio (T-051 parte 2, D-107): cuántas series de trabajo hizo por músculo
 * en el período. Sin `periodo` usa la semana. La identidad sale SIEMPRE del token, nunca de un
 * parámetro: un `socioId` en la URL se ignora. Cuelga de `/api/home-socio`, así que la entrada de
 * autorización ya existente cubre la ruta; acá se repite la regla (solo SOCIO). `no-store`: son datos
 * en vivo.
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
      { code: "FORBIDDEN", message: "El balance muscular es solo para socios" },
      { status: 403 }
    );
  }

  const periodoPedido = request.nextUrl.searchParams.get("periodo") ?? "semana";
  if (!esPeriodo(periodoPedido)) {
    return NextResponse.json(
      { code: "INVALID_PERIODO", message: "El período tiene que ser semana, 30d, 90d o todo" },
      { status: 400 }
    );
  }

  try {
    const socioId = await resolveSocioIdDeUsuario(user.id);
    if (!socioId) {
      return NextResponse.json(
        { code: "SOCIO_NOT_FOUND", message: "No se encontró el perfil de socio" },
        { status: 404 }
      );
    }

    const balance = await handleBalanceMuscular({ socioId, periodo: periodoPedido });
    return NextResponse.json(balance, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/home-socio/musculos failed:", error); // el detalle queda en el log
    return NextResponse.json(
      { code: "BALANCE_MUSCULAR_ERROR", message: "No se pudo calcular el balance muscular" },
      { status: 500 }
    );
  }
}
