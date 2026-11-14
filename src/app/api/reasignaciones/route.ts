import { NextRequest, NextResponse } from "next/server";
import { handleReasignar, handleSesionesEnCursoStaff } from "@/api/reasignaciones";
import { extractUserFromRequest } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/** P-61: solo el instructor y el administrador reasignan (D-126). Prefijo propio (D-132). */
const ALLOWED_ROLES = ["INSTRUCTOR", "ADMINISTRADOR"];

type Autorizacion = { usuarioId: string } | { response: NextResponse };

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
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return {
      response: NextResponse.json(
        { code: "FORBIDDEN", message: "No tiene permiso para realizar esta acción" },
        { status: 403 }
      ),
    };
  }
  return { usuarioId: user.id };
}

/** GET /api/reasignaciones — sesiones en curso para el panel del staff. */
export async function GET(request: NextRequest) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  try {
    return NextResponse.json(await handleSesionesEnCursoStaff());
  } catch (error) {
    const mapped = mapErrorToResponse(error, { resourceName: "Sesión" });
    return NextResponse.json({ code: mapped.code, message: mapped.message }, { status: mapped.status });
  }
}

/** POST /api/reasignaciones — cambia la máquina de una ejecución EN_CURSO. */
export async function POST(request: NextRequest) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
      { status: 400 }
    );
  }

  const resultado = await handleReasignar({
    body,
    responsableId: auth.usuarioId,
    ahora: new Date(),
  });
  return NextResponse.json(resultado.body, { status: resultado.status });
}
