import { NextRequest, NextResponse } from "next/server";
import { handleObtenerSugerencia, type ActorAsignaciones } from "@/api/asignaciones";
import { extractUserFromRequest } from "@/lib/auth";
import type { UserRole } from "@/lib/authorization";

const ALLOWED_ROLES: UserRole[] = ["SOCIO", "ADMINISTRADOR", "INSTRUCTOR"];

type Autorizacion = { actor: ActorAsignaciones } | { response: NextResponse };

function autorizar(request: NextRequest): Autorizacion {
  const user = extractUserFromRequest(request);
  if (!user) {
    return {
      response: NextResponse.json(
        { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
        { status: 401 }
      ),
    };
  }
  const rol = user.rol;
  if (!rol || !ALLOWED_ROLES.includes(rol)) {
    return {
      response: NextResponse.json(
        { code: "FORBIDDEN", message: "No tiene permiso para realizar esta acción" },
        { status: 403 }
      ),
    };
  }
  return { actor: { usuarioId: user.id, rol } };
}

export async function GET(request: NextRequest) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const socioIdQuery = new URL(request.url).searchParams.get("socioId");
  const { status, body } = await handleObtenerSugerencia({
    actor: auth.actor,
    socioIdQuery: socioIdQuery === "" ? null : socioIdQuery,
    ahora: new Date(),
  });

  return NextResponse.json(body, { status });
}
