import { NextRequest, NextResponse } from "next/server";
import { Ejercicio } from "@prisma/client";
import { handleEjercicioCreate, handleEjercicioList } from "@/api/ejercicios";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Discriminated union types for handler responses
 */
export type CreateSuccess = Ejercicio & { status: 201 };
export type CreateError = { code: string; message: string; status: number };
export type ListSuccess = Ejercicio[];
export type ListError = { code: string; message: string; status: number };

/**
 * Type guard to check if result is a success response
 */
function isCreateSuccess(result: CreateSuccess | CreateError): result is CreateSuccess {
  return "id" in result && (result as any).status === 201;
}

function isListSuccess(result: ListSuccess | ListError): result is ListSuccess {
  return Array.isArray(result);
}

/**
 * Core handler logic for POST /api/ejercicios
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Ejercicio with status 201, or error response
 */
export async function handleEjercicioCreateRequest(
  body: any
): Promise<CreateSuccess | CreateError> {
  try {
    const ejercicio = await handleEjercicioCreate(body);
    return { ...ejercicio, status: 201 } as CreateSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
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
 * Core handler logic for GET /api/ejercicios
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Ejercicio array or error response
 */
export async function handleEjercicioListRequest(options?: {
  muscleGroup?: string;
  search?: string;
}): Promise<ListSuccess | ListError> {
  try {
    const ejercicios = await handleEjercicioList(options);
    return ejercicios as ListSuccess;
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o instructor",
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
 * POST /api/ejercicios - Create a new ejercicio
 * Requires ADMINISTRADOR or INSTRUCTOR role
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await handleEjercicioCreateRequest(body);

  // If error response (has status property)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: result.status }
    );
  }

  // Success: return ejercicio
  return NextResponse.json(result, { status: 201 });
}

/**
 * GET /api/ejercicios - List all ejercicios
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const muscleGroup = searchParams.get("muscleGroup") || undefined;
  const search = searchParams.get("search") || undefined;

  const result = await handleEjercicioListRequest({
    muscleGroup,
    search,
  });

  // If error response (has status and code properties)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: result.status }
    );
  }

  // Success: return array of ejercicios
  return NextResponse.json(result, { status: 200 });
}
