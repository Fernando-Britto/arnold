import { NextRequest, NextResponse } from "next/server";
import {
  handleMaquinaEjerciciosGet,
  handleMaquinaEjerciciosPut,
} from "@/api/maquinas";
import type { EjercicioAsociado } from "@/domains/maquina/maquina";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { readJsonBody } from "@/lib/request-body";

/**
 * Discriminated union types for the nested assignment route.
 * Exported so tests can exercise the core logic without mocking
 * NextRequest/NextResponse.
 */
export type GetSuccess = EjercicioAsociado[];
export type GetError = { code: string; message: string; status: number };

export type PutSuccess = EjercicioAsociado[];
export type PutError = { code: string; message: string; status: number };

function isGetSuccess(result: GetSuccess | GetError): result is GetSuccess {
  return Array.isArray(result);
}

function isPutSuccess(result: PutSuccess | PutError): result is PutSuccess {
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

/**
 * Core handler logic for GET /api/maquinas/[id]/ejercicios.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleMaquinaEjerciciosGetRequest(
  id: string
): Promise<GetSuccess | GetError> {
  try {
    const ejercicios = await handleMaquinaEjerciciosGet(id);
    return ejercicios as GetSuccess;
  } catch (error) {
    return mapErrorToResponse(error, ERROR_OPTIONS);
  }
}

/**
 * Core handler logic for PUT /api/maquinas/[id]/ejercicios.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleMaquinaEjerciciosPutRequest(
  id: string,
  body: unknown
): Promise<PutSuccess | PutError> {
  try {
    const ejercicios = await handleMaquinaEjerciciosPut(id, body);
    return ejercicios as PutSuccess;
  } catch (error) {
    return mapErrorToResponse(error, ERROR_OPTIONS);
  }
}

/**
 * GET /api/maquinas/[id]/ejercicios
 * Returns the exercises associated with a machine.
 * Requires: Administrador role (defense in depth on top of middleware gating).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const result = await handleMaquinaEjerciciosGetRequest(id);

  if (isGetSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}

/**
 * PUT /api/maquinas/[id]/ejercicios
 * Replaces the exercises associated with a machine.
 * Requires: Administrador role (defense in depth on top of middleware gating).
 * Audits the successful assignment best-effort: an audit failure never alters the 200 response.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const result = await handleMaquinaEjerciciosPutRequest(id, parsed.body);

  if (isPutSuccess(result)) {
    try {
      await registrarOperacion({
        tipoOperacion: "MODIFICACION",
        responsableId: auth.user.id,
        detalles: { maquinaId: id, ejerciciosAsignados: result.length },
      });
    } catch {
      // Auditoría best-effort: el error ya fue logueado por registrarOperacion.
    }
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
