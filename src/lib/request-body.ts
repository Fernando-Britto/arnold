import { NextResponse } from "next/server";

/**
 * Result of a guarded JSON body read.
 * - `ok: true` → the body was parsed; use `body`.
 * - `ok: false` → the body was malformed; return `response` as-is (400).
 */
export type ReadJsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

/**
 * Safely parse a JSON request body.
 *
 * `await request.json()` throws a `SyntaxError` when the body is not valid
 * JSON. When that call sits outside a try/catch (as it did in several routes),
 * the error escapes the handler and Next.js answers with a raw **500**, even
 * though the client sent a bad request that deserves a **400**. This helper
 * catches the parse failure and returns a normalized 400 response using the
 * app's `{ code, message }` error envelope, so routes only need:
 *
 * ```ts
 * const parsed = await readJsonBody(request);
 * if (!parsed.ok) return parsed.response;
 * const body = parsed.body;
 * ```
 *
 * The generic parameter preserves the route's expected input type, e.g.
 * `readJsonBody<AsignarRutinaInput>(request)`.
 *
 * @param request The incoming request (NextRequest or Request).
 * @returns `{ ok: true, body }` on success, or `{ ok: false, response }` with a
 *          ready-to-return 400 response on malformed JSON.
 */
export async function readJsonBody<T = unknown>(
  request: Request
): Promise<ReadJsonBodyResult<T>> {
  try {
    const body = (await request.json()) as T;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "El cuerpo de la solicitud no es JSON válido",
        },
        { status: 400 }
      ),
    };
  }
}
