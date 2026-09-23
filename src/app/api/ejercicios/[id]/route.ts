import { NextRequest, NextResponse } from "next/server";
import {
  handleEjercicioGet,
  handleEjercicioUpdate,
  handleEjercicioDelete,
  type Ejercicio,
  type EjercicioInput,
} from "@/api/ejercicios";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Discriminated union types for handler responses
 */
export type GetSuccess = Ejercicio & { status: 200 };
export type GetError = { code: string; message: string; status: number };

export type UpdateSuccess = Ejercicio & { status: 200 };
export type UpdateError = { code: string; message: string; status: number };

export type DeleteSuccess = { message: string; status: 204 };
export type DeleteError = { code: string; message: string; status: number };

/**
 * Type guards for discriminated union responses
 */
function isGetSuccess(result: GetSuccess | GetError): result is GetSuccess {
  return "id" in result && (result as any).status === 200;
}

function isUpdateSuccess(result: UpdateSuccess | UpdateError): result is UpdateSuccess {
  return "id" in result && (result as any).status === 200;
}

function isDeleteSuccess(result: DeleteSuccess | DeleteError): result is DeleteSuccess {
  return "message" in result && (result as any).status === 204;
}

/**
 * Core handler logic for GET /api/ejercicios/[id]
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleEjercicioGetRequest(id: string): Promise<GetSuccess | GetError> {
  try {
    const ejercicio = await handleEjercicioGet(id);
    if (!ejercicio) {
      throw Object.assign(new Error("NOT_FOUND: Ejercicio no encontrado"), {
        code: "NOT_FOUND",
      });
    }
    return { ...ejercicio, status: 200 } as GetSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador",
      resourceName: "Ejercicio",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for PUT /api/ejercicios/[id]
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleEjercicioUpdateRequest(
  id: string,
  body: any
): Promise<UpdateSuccess | UpdateError> {
  try {
    const ejercicio = await handleEjercicioUpdate(id, body);
    return { ...ejercicio, status: 200 } as UpdateSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador",
      resourceName: "Ejercicio",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for DELETE /api/ejercicios/[id]
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleEjercicioDeleteRequest(id: string): Promise<DeleteSuccess | DeleteError> {
  try {
    const deleted = await handleEjercicioDelete(id);
    if (!deleted) {
      throw Object.assign(new Error("NOT_FOUND: Ejercicio no encontrado"), {
        code: "NOT_FOUND",
      });
    }
    return { message: "Ejercicio eliminado", status: 204 } as DeleteSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador",
      resourceName: "Ejercicio",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * GET /api/ejercicios/[id]
 * Returns single ejercicio by ID
 * Requires: Entrenador or Administrador role (handled by middleware)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await handleEjercicioGetRequest(params.id);

  if (isGetSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}

/**
 * PUT /api/ejercicios/[id]
 * Updates an ejercicio with validation
 * Requires: Entrenador or Administrador role (handled by middleware)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const result = await handleEjercicioUpdateRequest(params.id, body);

  if (isUpdateSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}

/**
 * DELETE /api/ejercicios/[id]
 * Deletes an ejercicio
 * Requires: Administrador role (handled by middleware)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await handleEjercicioDeleteRequest(params.id);

  if (isDeleteSuccess(result)) {
    return NextResponse.json(result, { status: 204 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
