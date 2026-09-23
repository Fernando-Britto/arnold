import { NextRequest, NextResponse } from "next/server";
import {
  handleMembresiaGetById,
  handleMembresiaUpdate,
  handleMembresiaDelete,
  type Membresia,
  type MembresiaInput,
} from "@/api/membresias";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Discriminated union types for handler responses
 */
export type GetSuccess = Membresia & { status: 200 };
export type GetError = { code: string; message: string; status: number };

export type UpdateSuccess = Membresia & { status: 200 };
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
 * Core handler logic for GET /api/membresias/[id]
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleMembresiaGetByIdRequest(id: string): Promise<GetSuccess | GetError> {
  try {
    const membresia = await handleMembresiaGetById(id);
    return { ...membresia, status: 200 } as GetSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador",
      resourceName: "Membresía",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for PUT /api/membresias/[id]
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleMembresiaUpdateRequest(
  id: string,
  body: any
): Promise<UpdateSuccess | UpdateError> {
  try {
    const membresia = await handleMembresiaUpdate(id, body);
    return { ...membresia, status: 200 } as UpdateSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador",
      resourceName: "Membresía",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for DELETE /api/membresias/[id]
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleMembresiaDeleteRequest(id: string): Promise<DeleteSuccess | DeleteError> {
  try {
    await handleMembresiaDelete(id);
    return { message: "Membresía eliminada", status: 204 } as DeleteSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador",
      resourceName: "Membresía",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * GET /api/membresias/[id]
 * Returns single membresia by ID with assigned member count
 * Requires: Administrador role (handled by middleware)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await handleMembresiaGetByIdRequest(params.id);

  if (isGetSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}

/**
 * PUT /api/membresias/[id]
 * Updates a membresia with validation
 * Shows deactivation warning (AC-005) if needed
 * Requires: Administrador role (handled by middleware)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const result = await handleMembresiaUpdateRequest(params.id, body);

  if (isUpdateSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}

/**
 * DELETE /api/membresias/[id]
 * Deletes a membresia (blocked if assigned members > 0)
 * Requires: Administrador role (handled by middleware)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await handleMembresiaDeleteRequest(params.id);

  if (isDeleteSuccess(result)) {
    return NextResponse.json(result, { status: 204 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
