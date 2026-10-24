import { NextRequest, NextResponse } from "next/server";
import { handleMaquinaList } from "@/api/maquinas";
import type { Maquina } from "@/domains/maquina/maquina";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";
import { EstadoMaquina, TipoEquipamiento } from "@prisma/client";

/**
 * Discriminated union types for handler responses.
 * Exported from route.ts so tests can exercise the core logic without
 * mocking NextRequest/NextResponse.
 */
export type ListSuccess = Maquina[];
export type ListError = { code: string; message: string; status: number };

function isListSuccess(result: ListSuccess | ListError): result is ListSuccess {
  return Array.isArray(result);
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

function buildValidationError(message: string): NextResponse {
  return NextResponse.json(
    { code: "VALIDATION_ERROR", message },
    { status: 400 }
  );
}

/**
 * Core handler logic for GET /api/maquinas.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleMaquinaListRequest(filters: {
  estado?: EstadoMaquina;
  tipoEquipamiento?: TipoEquipamiento;
  nombre?: string;
} = {}): Promise<ListSuccess | ListError> {
  try {
    const maquinas = await handleMaquinaList(filters);
    return maquinas as ListSuccess;
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
 * GET /api/maquinas
 * Returns all machines, optionally filtered by estado, tipoEquipamiento and nombre.
 * Requires: Administrador role (defense in depth on top of middleware gating).
 */
export async function GET(request: NextRequest) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = request.nextUrl;
  const estadoParam = searchParams.get("estado");
  const tipoParam = searchParams.get("tipoEquipamiento");
  const nombreParam = searchParams.get("nombre");

  const filters: {
    estado?: EstadoMaquina;
    tipoEquipamiento?: TipoEquipamiento;
    nombre?: string;
  } = {};

  if (estadoParam !== null) {
    if (!Object.values(EstadoMaquina).includes(estadoParam as EstadoMaquina)) {
      return buildValidationError("Estado inválido");
    }
    filters.estado = estadoParam as EstadoMaquina;
  }

  if (tipoParam !== null) {
    if (
      !Object.values(TipoEquipamiento).includes(tipoParam as TipoEquipamiento)
    ) {
      return buildValidationError("Tipo de equipamiento inválido");
    }
    filters.tipoEquipamiento = tipoParam as TipoEquipamiento;
  }

  if (nombreParam !== null) {
    const trimmed = nombreParam.trim();
    if (trimmed) filters.nombre = trimmed;
  }

  const result = await handleMaquinaListRequest(filters);

  if (isListSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
