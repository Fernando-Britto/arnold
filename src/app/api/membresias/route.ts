import { NextRequest, NextResponse } from "next/server";
import {
  handleMembresiaList,
  handleMembresiaCreate,
  type Membresia,
  type MembresiaInput,
} from "@/api/membresias";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Discriminated union types for handler responses
 * Exported from route.ts (day 1) per spec
 */
export type ListSuccess = Membresia[];
export type ListError = { code: string; message: string; status: number };

export type CreateSuccess = Membresia & { status: 201 };
export type CreateError = { code: string; message: string; status: number };

/**
 * Type guards for discriminated union responses
 * Internal use only
 */
function isListSuccess(result: ListSuccess | ListError): result is ListSuccess {
  return Array.isArray(result);
}

function isCreateSuccess(result: CreateSuccess | CreateError): result is CreateSuccess {
  return "id" in result && (result as any).status === 201;
}

/**
 * Core handler logic for GET /api/membresias
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Membresia array with assignedSocioCount, or error response
 */
export async function handleMembresiaListRequest(activeOnly?: boolean): Promise<ListSuccess | ListError> {
  try {
    // Pass activeOnly option to handler for efficient database-level filtering
    const membresias = await handleMembresiaList({ activeOnly: activeOnly || false });
    return membresias as ListSuccess;
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
 * Core handler logic for POST /api/membresias
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Membresia with status 201, or error response
 */
export async function handleMembresiaCreateRequest(
  body: any
): Promise<CreateSuccess | CreateError> {
  try {
    const membresia = await handleMembresiaCreate(body);
    return { ...membresia, status: 201 } as CreateSuccess;
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
 * GET /api/membresias
 * Returns list of all membresias with assigned member counts
 * Optional: activeOnly=true returns ACTIVA only (for T-013 dropdown)
 * Requires: Administrador role (handled by middleware)
 */
export async function GET(request: NextRequest) {
  const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
  const result = await handleMembresiaListRequest(activeOnly);

  if (isListSuccess(result)) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}

/**
 * POST /api/membresias
 * Creates a new membresia with validation
 * Requires: Administrador role (handled by middleware)
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await handleMembresiaCreateRequest(body);

  if (isCreateSuccess(result)) {
    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
