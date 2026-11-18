import { NextRequest, NextResponse } from "next/server";
import {
  handleBuscarSocio,
  handleBuscarSociosPorNombre,
  type BusquedaSociosResultado,
} from "@/api/socios";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";

/** Roles que pueden buscar socios por DNI: cobrar (D-42) y asignar rutina (N1). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR"];
/** Roles de la búsqueda por nombre: el listado expone estado de cuota (solo staff de cobro). */
const SEARCH_ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * Core handler logic for GET /api/socios?dni=.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleBuscarSocioRequest(dni: string): Promise<HandlerResult> {
  try {
    const socio = await handleBuscarSocio(dni);
    return { status: 200, body: socio };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador, recepcionista o instructor",
      resourceName: "Socio",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * Core handler logic for GET /api/socios?q=.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleBuscarSociosRequest(
  q: string,
  limit?: number,
  offset?: number,
): Promise<HandlerResult> {
  try {
    const resultado: BusquedaSociosResultado = await handleBuscarSociosPorNombre({ q, limit, offset });
    return { status: 200, body: resultado };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Socio",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

export type PaginacionSocios =
  | { ok: true; limit: number; offset: number }
  | { ok: false; message: string };

/**
 * Valida `limit`/`offset` de la búsqueda por nombre. Pura y exportada para testear sin
 * NextRequest: `limit` 1..50 (default 10) y `offset` ≥ 0 (default 0), solo dígitos.
 */
export function parsePaginacionSocios(
  rawLimit: string | null,
  rawOffset: string | null,
): PaginacionSocios {
  const limit = rawLimit === null ? 10 : /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { ok: false, message: "El parámetro limit debe estar entre 1 y 50" };
  }

  const offset = rawOffset === null ? 0 : /^\d+$/.test(rawOffset) ? Number(rawOffset) : NaN;
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, message: "El parámetro offset debe ser un número entero" };
  }

  return { ok: true, limit, offset };
}

/**
 * GET /api/socios?dni= | ?q= — búsqueda por DNI (con estado de cuota y plan de pago) o por
 * nombre (paginada). Requiere sesión y rol autorizado según la rama. Solo lectura.
 */
export async function GET(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const dni = searchParams.get("dni");
  const q = searchParams.get("q");

  if (!dni && !q) {
    return NextResponse.json(
      { code: "VALIDATION_REQUIRED", message: "Se requiere el parámetro dni o q" },
      { status: 400 }
    );
  }

  // La búsqueda por DNI la usa también el Instructor (N1); la de nombre, solo cobro.
  const allowedRoles = dni ? ALLOWED_ROLES : SEARCH_ALLOWED_ROLES;
  if (!user.rol || !allowedRoles.includes(user.rol)) {
    return NextResponse.json(
      {
        code: "FORBIDDEN",
        message: dni
          ? "Se requiere rol de administrador, recepcionista o instructor"
          : "Se requiere rol de administrador o recepcionista",
      },
      { status: 403 }
    );
  }

  if (dni) {
    const { status, body } = await handleBuscarSocioRequest(dni);
    return NextResponse.json(body, { status });
  }

  const paginacion = parsePaginacionSocios(searchParams.get("limit"), searchParams.get("offset"));
  if (!paginacion.ok) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: paginacion.message },
      { status: 400 }
    );
  }

  const { status, body } = await handleBuscarSociosRequest(q!, paginacion.limit, paginacion.offset);
  return NextResponse.json(body, { status });
}
