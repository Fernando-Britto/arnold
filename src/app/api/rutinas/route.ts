import { NextRequest, NextResponse } from "next/server";
import { Rutina } from "@prisma/client";
import {
  handleRutinaCreate,
  handleRutinaList,
  handleRutinaGet,
  handleRutinaUpdate,
  handleRutinaDelete,
  type RutinaInput,
} from "@/api/rutinas";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Discriminated union types for handler responses
 * CRITICAL: These are exported from route.ts (day 1) per T-008 spec
 */
export type CreateSuccess = Rutina & { status: 201 };
export type CreateError = { code: string; message: string; status: number };

export type GetSuccess = Rutina;
export type GetError = { code: string; message: string; status: number };

export type ListSuccess = (Rutina & { _count: { ejercicios: number } })[];
export type ListError = { code: string; message: string; status: number };

export type UpdateSuccess = Rutina & { status: 200 };
export type UpdateError = { code: string; message: string; status: number };

export type DeleteSuccess = { message: string; status: 204 };
export type DeleteError = { code: string; message: string; status: number };

/**
 * Type guards for discriminated union responses
 * Internal use only, not exported
 */
function isCreateSuccess(result: CreateSuccess | CreateError): result is CreateSuccess {
  return "id" in result && (result as any).status === 201;
}

function isGetSuccess(result: GetSuccess | GetError): result is GetSuccess {
  return "id" in result && !("status" in result) && !("code" in result);
}

function isListSuccess(result: ListSuccess | ListError): result is ListSuccess {
  return Array.isArray(result);
}

function isUpdateSuccess(result: UpdateSuccess | UpdateError): result is UpdateSuccess {
  return "id" in result && (result as any).status === 200;
}

function isDeleteSuccess(result: DeleteSuccess | DeleteError): result is DeleteSuccess {
  return "message" in result && (result as any).status === 204;
}

/**
 * Core handler logic for POST /api/rutinas
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Rutina with status 201, or error response
 */
export async function handleRutinaCreateRequest(body: any): Promise<CreateSuccess | CreateError> {
  try {
    const rutina = await handleRutinaCreate(body);
    return { ...rutina, status: 201 } as CreateSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
      resourceName: "Rutina",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for GET /api/rutinas/:id
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Rutina or error response
 */
export async function handleRutinaGetRequest(id: string): Promise<GetSuccess | GetError> {
  try {
    const rutina = await handleRutinaGet(id);
    if (!rutina) {
      throw new Error("NOT_FOUND");
    }
    return rutina as GetSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
      resourceName: "Rutina",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for GET /api/rutinas
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Rutina array or error response
 */
export async function handleRutinaListRequest(): Promise<ListSuccess | ListError> {
  try {
    const rutinas = await handleRutinaList();
    return rutinas as ListSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
      resourceName: "Rutina",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for PUT /api/rutinas/:id
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Rutina with status 200, or error response
 */
export async function handleRutinaUpdateRequest(
  id: string,
  body: any
): Promise<UpdateSuccess | UpdateError> {
  try {
    const rutina = await handleRutinaUpdate(id, body);
    if (!rutina) {
      throw new Error("NOT_FOUND");
    }
    return { ...rutina, status: 200 } as UpdateSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
      resourceName: "Rutina",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * Core handler logic for DELETE /api/rutinas/:id
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Success message with status 204, or error response
 */
export async function handleRutinaDeleteRequest(id: string): Promise<DeleteSuccess | DeleteError> {
  try {
    await handleRutinaDelete(id);
    return {
      message: "Rutina eliminada exitosamente",
      status: 204,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Handle cascade delete block
    if (message.includes("DELETE_BLOCKED_ASSIGNED")) {
      const match = message.match(/DELETE_BLOCKED_ASSIGNED: (.+)/);
      return {
        code: "DELETE_BLOCKED",
        message: match ? match[1] : "Rutina asignada activamente a 1 socio(s)",
        status: 409,
      };
    }

    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
      resourceName: "Rutina",
    });
    return {
      code: mapped.code,
      message: mapped.message,
      status: mapped.status,
    };
  }
}

/**
 * POST /api/rutinas - Create a new rutina
 * Requires ADMINISTRADOR or INSTRUCTOR role
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await handleRutinaCreateRequest(body);

  // If error response (has status property with code)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: result.status }
    );
  }

  // Success: return rutina with 201
  return NextResponse.json(result, { status: 201 });
}

/**
 * GET /api/rutinas - List all rutinas
 */
export async function GET(request: NextRequest) {
  const result = await handleRutinaListRequest();

  // If error response (has status and code properties)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: result.status }
    );
  }

  // Success: return array of rutinas
  return NextResponse.json(result, { status: 200 });
}
