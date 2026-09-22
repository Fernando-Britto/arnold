import { NextRequest, NextResponse } from "next/server";
import { Cliente } from "@/domains/cliente/cliente";
import {
  handleClienteCreate,
  handleClienteList,
  type ClienteInput,
} from "@/api/clientes";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

/**
 * Discriminated union types for handler responses
 * CRITICAL: Exported from route.ts (day 1) per T-012 spec
 */
export type CreateSuccess = Cliente & { status: 201 };
export type CreateError = { code: string; message: string; status: number };

export type ListSuccess = Cliente[];
export type ListError = { code: string; message: string; status: number };

export type GetSuccess = Cliente;
export type GetError = { code: string; message: string; status: number };

export type UpdateSuccess = Cliente & { status: 200 };
export type UpdateError = { code: string; message: string; status: number };

export type DeleteSuccess = { message: string; status: 204 };
export type DeleteError = { code: string; message: string; status: number };

/**
 * Type guards for discriminated union responses
 * Internal use only
 */
function isCreateSuccess(result: CreateSuccess | CreateError): result is CreateSuccess {
  return "id" in result && (result as any).status === 201;
}

function isListSuccess(result: ListSuccess | ListError): result is ListSuccess {
  return Array.isArray(result);
}

/**
 * Core handler logic for POST /api/clientes
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Cliente with status 201, or error response
 */
export async function handleClienteCreateRequest(
  body: any
): Promise<CreateSuccess | CreateError> {
  try {
    const cliente = await handleClienteCreate(body);
    return { ...cliente, status: 201 } as CreateSuccess;
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
 * Core handler logic for GET /api/clientes
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Cliente array or error response
 */
export async function handleClienteListRequest(): Promise<ListSuccess | ListError> {
  try {
    const clientes = await handleClienteList();
    return clientes as ListSuccess;
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
 * POST /api/clientes - Create a new cliente
 * Requires ADMINISTRADOR or RECEPCIONISTA role
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await handleClienteCreateRequest(body);

  // If error response
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: result.status }
    );
  }

  // Success: return cliente with 201
  return NextResponse.json(result, { status: 201 });
}

/**
 * GET /api/clientes - List all clientes
 */
export async function GET(request: NextRequest) {
  const result = await handleClienteListRequest();

  // If error response
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: (result as ListError).code, message: (result as ListError).message },
      { status: (result as ListError).status }
    );
  }

  // Success: return array of clientes
  return NextResponse.json(result, { status: 200 });
}
