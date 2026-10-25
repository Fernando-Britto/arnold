import { NextRequest, NextResponse } from "next/server";
import { Ejercicio } from "@prisma/client";
import {
  handleEjercicioCreate,
  handleEjercicioList,
  type EjercicioConUso,
  type EjercicioInput,
} from "@/api/ejercicios";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { readJsonBody } from "@/lib/request-body";

/**
 * Discriminated union types for handler responses
 */
export type CreateSuccess = Ejercicio & { status: 201 };
export type CreateError = { code: string; message: string; status: number };
export type ListSuccess = EjercicioConUso[];
export type ListError = { code: string; message: string; status: number };

/**
 * Core handler logic for POST /api/ejercicios
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Ejercicio with status 201, or error response
 */
export async function handleEjercicioCreateRequest(
  body: unknown
): Promise<CreateSuccess | CreateError> {
  try {
    const ejercicio = await handleEjercicioCreate(body as EjercicioInput);
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

export type Paginacion =
  | { ok: true; limit?: number; offset?: number }
  | { ok: false; message: string };

/**
 * Valida `limit`/`offset` de `GET /api/ejercicios`. Pura y exportada para testear sin
 * NextRequest. Sin ninguno de los dos no hay paginación (compatibilidad con /ejercicios);
 * con al menos uno, los faltantes caen a 20/0.
 */
export function parsePaginacion(
  rawLimit: string | null,
  rawOffset: string | null
): Paginacion {
  if (rawLimit === null && rawOffset === null) return { ok: true };

  const limit =
    rawLimit === null ? 20 : /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { ok: false, message: "El parámetro limit debe estar entre 1 y 50" };
  }

  const offset =
    rawOffset === null ? 0 : /^\d+$/.test(rawOffset) ? Number(rawOffset) : NaN;
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, message: "El parámetro offset debe ser un número entero" };
  }

  return { ok: true, limit, offset };
}

/**
 * Core handler logic for GET /api/ejercicios
 * Exported for testing without NextRequest/NextResponse mocking
 * @returns Ejercicio array or error response
 */
export async function handleEjercicioListRequest(options?: {
  muscleGroup?: string;
  search?: string;
  limit?: number;
  offset?: number;
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
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const result = await handleEjercicioCreateRequest(body);

  // If error response (has status property)
  if ("status" in result && "code" in result) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: result.status }
    );
  }

  // Auditoría best-effort: no altera la respuesta HTTP.
  const user = extractUserFromRequest(request);
  if (user) {
    await registrarOperacion({
      tipoOperacion: "ALTA",
      responsableId: user.id,
      detalles: { ejercicioId: result.id },
    });
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
  const paginacion = parsePaginacion(
    searchParams.get("limit"),
    searchParams.get("offset")
  );
  if (!paginacion.ok) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: paginacion.message },
      { status: 400 }
    );
  }

  const result = await handleEjercicioListRequest({
    muscleGroup,
    search,
    ...(paginacion.limit !== undefined && { limit: paginacion.limit }),
    ...(paginacion.offset !== undefined && { offset: paginacion.offset }),
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
