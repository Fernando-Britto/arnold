import { NextRequest, NextResponse } from "next/server";
import { handleEjercicioCreate, handleEjercicioList } from "@/api/ejercicios";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Core handler logic for POST /api/ejercicios
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns ejercicio object or { code, message, status }
 */
export async function handleEjercicioCreateRequest(body: any): Promise<
  | any
  | {
      code: string;
      message: string;
      status: number;
    }
> {
  try {
    const ejercicio = await handleEjercicioCreate(body);
    return { ...ejercicio, status: 201 };
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
 * @returns ejercicios array or { code, message, status }
 */
export async function handleEjercicioListRequest(options?: {
  muscleGroup?: string;
  search?: string;
}): Promise<any[] | { code: string; message: string; status: number }> {
  try {
    const ejercicios = await handleEjercicioList(options);
    // Array with implicit status 200
    return (ejercicios as any[]).map((e) => ({ ...e }));
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
