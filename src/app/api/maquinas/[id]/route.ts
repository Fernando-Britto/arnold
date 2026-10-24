import { NextRequest, NextResponse } from "next/server";
import { handleMaquinaGetById } from "@/api/maquinas";
import type { Maquina } from "@/domains/maquina/maquina";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";

/**
 * Discriminated union types for handler responses.
 * Exported from route.ts so tests can exercise the core logic without
 * mocking NextRequest/NextResponse.
 */
export type GetSuccess = Maquina & { status: 200 };
export type GetError = { code: string; message: string; status: number };

function isGetSuccess(result: GetSuccess | GetError): result is GetSuccess {
  return "id" in result && result.status === 200;
}

const ALLOWED_ROLES = ["ADMINISTRADOR"];

interface HandlerAuthorization {
  user: { id: string; rol?: string };
}

interface HandlerDenial {
  response: NextResponse;
}

type Autorizacion = HandlerAuthorization | HandlerDenial;

function autorizar(request: NextRequest): Autorizacion {
  const user = extractUserFromRequest(request);
  if (!user) {
    return {
      response: NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Token de autenticación inválido o faltante",
        },
        { status: 401 }
      ),
    };
  }
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return {
      response: NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "Se requiere rol de administrador",
        },
        { status: 403 }
      ),
    };
  }
  return { user };
}

const ERROR_OPTIONS = {
  forbiddenMessage: "Se requiere rol de administrador",
  resourceName: "Máquina",
};

/**
 * Core handler logic for GET /api/maquinas/[id].
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleMaquinaGetByIdRequest(
  id: string
): Promise<GetSuccess | GetError> {
  try {
    const maquina = await handleMaquinaGetById(id);
    return { ...maquina, status: 200 } as GetSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, ERROR_OPTIONS);
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * GET /api/maquinas/[id]
 * Returns a single machine by ID.
 * Requires: Administrador role (defense in depth on top of middleware gating).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const result = await handleMaquinaGetByIdRequest(id);

  if (isGetSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
