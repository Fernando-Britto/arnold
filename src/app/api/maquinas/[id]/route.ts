import { NextRequest, NextResponse } from "next/server";
import {
  handleMaquinaGetById,
  handleMaquinaUpdate,
  handleMaquinaDelete,
} from "@/api/maquinas";
import type { Maquina, MaquinaInput } from "@/domains/maquina/maquina";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { readJsonBody } from "@/lib/request-body";

/**
 * Discriminated union types for handler responses.
 * Exported from route.ts so tests can exercise the core logic without
 * mocking NextRequest/NextResponse.
 */
export type GetSuccess = Maquina & { status: 200 };
export type GetError = { code: string; message: string; status: number };

export type UpdateSuccess = Maquina & { status: 200 };
export type UpdateError = { code: string; message: string; status: number };

export type DeleteSuccess = { message: string; status: 204 };
export type DeleteError = { code: string; message: string; status: number };

function isGetSuccess(result: GetSuccess | GetError): result is GetSuccess {
  return "id" in result && result.status === 200;
}

function isUpdateSuccess(result: UpdateSuccess | UpdateError): result is UpdateSuccess {
  return "id" in result && result.status === 200;
}

function isDeleteSuccess(result: DeleteSuccess | DeleteError): result is DeleteSuccess {
  return "message" in result && result.status === 204;
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
 * Core handler logic for PUT /api/maquinas/[id].
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleMaquinaUpdateRequest(
  id: string,
  body: unknown
): Promise<UpdateSuccess | UpdateError> {
  try {
    const maquina = await handleMaquinaUpdate(id, body as MaquinaInput);
    return { ...maquina, status: 200 } as UpdateSuccess;
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
 * Core handler logic for DELETE /api/maquinas/[id].
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleMaquinaDeleteRequest(
  id: string
): Promise<DeleteSuccess | DeleteError> {
  try {
    await handleMaquinaDelete(id);
    return { message: "Máquina eliminada", status: 204 } as DeleteSuccess;
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

/**
 * PUT /api/maquinas/[id]
 * Updates a machine.
 * Requires: Administrador role (defense in depth on top of middleware gating).
 * Audits the successful update best-effort: an audit failure never alters the 200 response.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  const result = await handleMaquinaUpdateRequest(id, parsed.body);

  if (isUpdateSuccess(result)) {
    try {
      await registrarOperacion({
        tipoOperacion: "MODIFICACION",
        responsableId: auth.user.id,
        detalles: { maquinaId: result.id },
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

/**
 * DELETE /api/maquinas/[id]
 * Deletes a machine.
 * Requires: Administrador role (defense in depth on top of middleware gating).
 * Audits the successful deletion best-effort: an audit failure never alters the 204 response.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = autorizar(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const result = await handleMaquinaDeleteRequest(id);

  if (isDeleteSuccess(result)) {
    try {
      await registrarOperacion({
        tipoOperacion: "BAJA",
        responsableId: auth.user.id,
        detalles: { maquinaId: id },
      });
    } catch {
      // Auditoría best-effort: el error ya fue logueado por registrarOperacion.
    }
    // 204 No Content no admite cuerpo: NextResponse.json lo rechaza.
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
