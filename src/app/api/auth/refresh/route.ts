import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, SESSION_TTL_SECONDS, authCookieOptions, handleRefreshRequest } from '@/api/auth';
import { REFRESH_COOKIE_NAME, REFRESH_TTL_SECONDS } from '@/lib/refresh-token';

/**
 * POST /api/auth/refresh (P-20). Toma el refresh token de la cookie `authRefresh`, lo rota en el
 * servidor y devuelve un access token nuevo. 204 sin cuerpo en éxito; 401 si falta, venció, está
 * revocado (reuso) o el usuario ya no está activo. La cookie `authToken` (24 h) no cambia de forma.
 */
export async function POST(request: NextRequest) {
  const presented = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const result = await handleRefreshRequest(presented);

  if (result.status !== 204) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(AUTH_COOKIE_NAME, result.accessToken, authCookieOptions(SESSION_TTL_SECONDS));
  response.cookies.set(REFRESH_COOKIE_NAME, result.refreshToken, authCookieOptions(REFRESH_TTL_SECONDS));
  return response;
}
