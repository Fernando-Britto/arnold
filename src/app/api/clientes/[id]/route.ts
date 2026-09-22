import { NextRequest, NextResponse } from "next/server";
import { handleClienteGet, handleClienteUpdate, handleClienteDelete, type ClienteInput } from "@/api/clientes";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import type {
  GetSuccess as GetSuccessType,
  GetError as GetErrorType,
  UpdateSuccess as UpdateSuccessType,
  UpdateError as UpdateErrorType,
  DeleteSuccess as DeleteSuccessType,
  DeleteError as DeleteErrorType,
} from "@/app/api/clientes/route";

// Re-export types for test consumption
export type GetSuccess = GetSuccessType;
export type GetError = GetErrorType;
export type UpdateSuccess = UpdateSuccessType;
export type UpdateError = UpdateErrorType;
export type DeleteSuccess = DeleteSuccessType;
export type DeleteError = DeleteErrorType;

/**
 * Core handler logic for GET /api/clientes/:id
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleClienteGetRequest(id: string): Promise<GetSuccessType | GetErrorType> {
  try {
    const cliente = await handleClienteGet(id);
    if (!cliente) {
      throw new Error("NOT_FOUND");
    }
    return cliente as GetSuccessType;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Cliente",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for PUT /api/clientes/:id
 * AC-007: id and fechaAlta are read-only (never editable)
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleClienteUpdateRequest(
  id: string,
  body: any
): Promise<UpdateSuccessType | UpdateErrorType> {
  try {
    // AC-007: Reject attempts to edit id or fechaAlta
    if ("id" in body || "fechaAlta" in body) {
      throw new Error("VALIDATION_ERROR: id y fechaAlta son campos de solo lectura");
    }

    const cliente = await handleClienteUpdate(id, body);
    if (!cliente) {
      throw new Error("NOT_FOUND");
    }
    return { ...cliente, status: 200 } as UpdateSuccessType;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Cliente",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for DELETE /api/clientes/:id
 * Exported for testing without NextRequest/NextResponse mocking
 */
export async function handleClienteDeleteRequest(id: string): Promise<DeleteSuccessType | DeleteErrorType> {
  try {
    await handleClienteDelete(id);
    return {
      message: "Cliente eliminado exitosamente",
      status: 204,
    };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Cliente",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * GET /api/clientes/:id - Get a specific cliente by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params per Next.js 16 App Router spec
  const { id } = await params;
  const result = await handleClienteGetRequest(id);

  // If error response
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: (result as GetErrorType).code, message: (result as GetErrorType).message },
      { status: (result as GetErrorType).status }
    );
  }

  // Success: return cliente
  return NextResponse.json(result, { status: 200 });
}

/**
 * PUT /api/clientes/:id - Update a specific cliente
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params per Next.js 16 App Router spec
  const { id } = await params;
  const body = await request.json();
  const result = await handleClienteUpdateRequest(id, body);

  // If error response
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: (result as UpdateErrorType).code, message: (result as UpdateErrorType).message },
      { status: (result as UpdateErrorType).status }
    );
  }

  // Success: return updated cliente
  return NextResponse.json(result, { status: 200 });
}

/**
 * DELETE /api/clientes/:id - Delete a specific cliente
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params per Next.js 16 App Router spec
  const { id } = await params;
  const result = await handleClienteDeleteRequest(id);

  // If error response
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: (result as DeleteErrorType).code, message: (result as DeleteErrorType).message },
      { status: (result as DeleteErrorType).status }
    );
  }

  // Success: 204 No Content (no body)
  return new NextResponse(null, { status: 204 });
}
