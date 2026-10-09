import { NextResponse } from "next/server";
import { buildHomeInternoPayload } from "@/api/home-interno-data";

/**
 * Core handler logic for GET /api/home-interno.
 * Exported for testing without NextResponse mocking.
 */
export async function handleHomeInternoRequest(): Promise<{ status: number; body: unknown }> {
  try {
    return { status: 200, body: await buildHomeInternoPayload() };
  } catch (error) {
    console.error("GET /api/home-interno failed:", error); // detail stays in the server log
    return {
      status: 500,
      body: { code: "HOME_INTERNO_ERROR", message: "No se pudo cargar el resumen operativo" },
    };
  }
}

/**
 * GET /api/home-interno
 * Raw facts for Home_Interno. Who may call it (Administrador, Instructor,
 * Recepcionista) is decided by the proxy's access matrix.
 * `no-store`: the spec requires live data, not snapshots older than the page session.
 */
export async function GET() {
  const inicio = performance.now();
  const { status, body } = await handleHomeInternoRequest();
  // Server-Timing (P-07): cuánto tardó armar los datos. Se ve con `curl -i` o en la pestaña Network del navegador.
  const ms = Math.round(performance.now() - inicio);
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Server-Timing": `datos;dur=${ms}` },
  });
}
