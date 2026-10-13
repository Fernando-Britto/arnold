import { NextRequest, NextResponse } from "next/server";
import {
  handleCerrarCaja,
  handleListarCierres,
  handlePrevisualizarCierre,
} from "@/api/cierres";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { extractUserFromRequest } from "@/lib/auth";

/** Roles que pueden cerrar y consultar cajas (D-42 / matriz de autorización). */
const ALLOWED_ROLES = ["ADMINISTRADOR", "RECEPCIONISTA"];

interface HandlerResult {
  status: number;
  body: unknown;
}

interface CuerpoDeCierre {
  desde?: unknown;
  hasta?: unknown;
}

/**
 * Parsea una fecha ISO opcional del cuerpo. `undefined` si no vino; `null` si vino
 * pero es inválida (el route la traduce a 400).
 */
function parseFecha(valor: unknown): Date | undefined | null {
  if (valor === undefined || valor === null || valor === "") return undefined;
  if (typeof valor !== "string") return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Core handler logic for POST /api/cierres.
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleCerrarCajaRequest(
  usuarioId: string,
  desde?: Date,
  hasta?: Date
): Promise<HandlerResult> {
  try {
    const cierre = await handleCerrarCaja({ usuarioId, desde, hasta });
    return { status: 201, body: cierre };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Cierre de caja",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/** Core handler logic for GET /api/cierres (lista). */
export async function handleListarCierresRequest(): Promise<HandlerResult> {
  try {
    const cierres = await handleListarCierres();
    return { status: 200, body: cierres };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Cierre de caja",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/** Core handler logic for GET /api/cierres?preview=1 (previsualización). */
export async function handlePrevisualizarCierreRequest(): Promise<HandlerResult> {
  try {
    const totales = await handlePrevisualizarCierre();
    return { status: 200, body: totales };
  } catch (error) {
    const mapped = mapErrorToResponse(error, {
      forbiddenMessage: "Se requiere rol de administrador o recepcionista",
      resourceName: "Cierre de caja",
    });
    return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  }
}

/**
 * POST /api/cierres — cierra la caja del turno. Cuerpo opcional `{ desde?, hasta? }`;
 * sin cuerpo usa el día del gimnasio hasta ahora. Requiere ADMINISTRADOR o RECEPCIONISTA.
 */
export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
      { status: 401 }
    );
  }
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Se requiere rol de administrador o recepcionista" },
      { status: 403 }
    );
  }

  let cuerpo: CuerpoDeCierre = {};
  const raw = await request.text();
  if (raw.trim()) {
    try {
      cuerpo = JSON.parse(raw) as CuerpoDeCierre;
    } catch {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Cuerpo de la solicitud inválido" },
        { status: 400 }
      );
    }
  }

  const desde = parseFecha(cuerpo?.desde);
  const hasta = parseFecha(cuerpo?.hasta);
  if (desde === null || hasta === null) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "El rango de fechas es inválido" },
      { status: 400 }
    );
  }

  const { status, body } = await handleCerrarCajaRequest(user.id, desde, hasta);
  return NextResponse.json(body, { status });
}

/**
 * GET /api/cierres — lista los cierres recientes; con `?preview=1` devuelve los
 * totales pendientes del turno. Requiere ADMINISTRADOR o RECEPCIONISTA.
 */
export async function GET(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Token de autenticación inválido o faltante" },
      { status: 401 }
    );
  }
  if (!user.rol || !ALLOWED_ROLES.includes(user.rol)) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Se requiere rol de administrador o recepcionista" },
      { status: 403 }
    );
  }

  const esPreview = request.nextUrl.searchParams.get("preview") === "1";
  const { status, body } = esPreview
    ? await handlePrevisualizarCierreRequest()
    : await handleListarCierresRequest();
  return NextResponse.json(body, { status });
}
