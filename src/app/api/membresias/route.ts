import { NextRequest, NextResponse } from "next/server";
import {
  handleMembresiaList,
  handleMembresiaCreate,
  type Membresia,
  type MembresiaInput,
} from "@/api/membresias";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { readJsonBody } from "@/lib/request-body";

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
  return "id" in result && result.status === 201;
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
  body: unknown
): Promise<CreateSuccess | CreateError> {
  try {
    const membresia = await handleMembresiaCreate(body as MembresiaInput);
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
 * Returns list of all membresias with assigned member counts.
 * The active-only dropdown (T-013) uses GET /api/membresias/activas, so this
 * endpoint has no `activeOnly` filter.
 * Requires: Administrador role (handled by middleware)
 */
export async function GET() {
  const result = await handleMembresiaListRequest();

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
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const result = await handleMembresiaCreateRequest(body);

  if (isCreateSuccess(result)) {
    // Auditoría best-effort: no altera la respuesta HTTP.
    const user = extractUserFromRequest(request);
    if (user) {
      await registrarOperacion({
        tipoOperacion: "ALTA",
        responsableId: user.id,
        detalles: { membresiaId: result.id },
      });
    }
    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.json(
    { code: result.code, message: result.message },
    { status: result.status }
  );
}
