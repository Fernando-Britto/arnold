import { NextResponse } from "next/server";
import { handleMembresiasActivas, type MembresiaDropdown } from "@/api/membresias";
import { mapErrorToResponse } from "@/lib/route-error-mapper";

export type ActivasError = { code: string; message: string; status: number };

/**
 * Core handler logic for GET /api/membresias/activas
 * Exported for testing without NextRequest/NextResponse mocking.
 */
export async function handleMembresiasActivasRequest(): Promise<MembresiaDropdown[] | ActivasError> {
  try {
    return await handleMembresiasActivas();
  } catch (error) {
    const { code, message, status } = mapErrorToResponse(error, {
      forbiddenMessage: "No tenés permiso para ver las membresías",
      resourceName: "Membresía",
    });
    return { code, message, status };
  }
}

/**
 * GET /api/membresias/activas
 * Active plans for the Clientes dropdown. Allowed for Administrador and
 * Recepcionista by the proxy's access matrix; nothing else about Membresías is.
 */
export async function GET() {
  const result = await handleMembresiasActivasRequest();
  if (Array.isArray(result)) {
    return NextResponse.json(result, { status: 200 });
  }
  return NextResponse.json({ code: result.code, message: result.message }, { status: result.status });
}
