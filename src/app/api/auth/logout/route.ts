import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, authCookieOptions } from '@/api/auth';
import { verifyJWT } from '@/lib/auth';
import { cleanupExpiredRevocations, revokeToken } from '@/lib/token-revocation';
import { REFRESH_COOKIE_NAME, revokeRefreshTokenByValue } from '@/lib/refresh-token';

/**
 * POST /api/auth/logout
 * Revoca el token de la sesión (P-06), revoca el refresh token (P-20) y borra ambas cookies.
 * Siempre responde 200 y cierra la sesión en el navegador, aunque no haya sesión, el token sea
 * inválido o falle la base al revocar (en ese caso el error queda en el log del servidor).
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? verifyJWT(token) : null;
  if (payload) {
    try {
      await revokeToken(payload);
      await cleanupExpiredRevocations();
    } catch (error) {
      console.error('[LOGOUT] no se pudo revocar el token:', error);
    }
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (refreshToken) {
    try {
      await revokeRefreshTokenByValue(refreshToken);
    } catch (error) {
      console.error('[LOGOUT] no se pudo revocar el refresh token:', error);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', authCookieOptions(0));
  response.cookies.set(REFRESH_COOKIE_NAME, '', authCookieOptions(0));
  return response;
}
