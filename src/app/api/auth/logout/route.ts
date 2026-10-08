import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, authCookieOptions } from '@/api/auth';
import { verifyJWT } from '@/lib/auth';
import { cleanupExpiredRevocations, revokeToken } from '@/lib/token-revocation';

/**
 * POST /api/auth/logout
 * Revoca el token de la sesión (P-06) y borra la cookie. Siempre responde 200 y cierra la sesión en
 * el navegador, aunque no haya sesión, el token sea inválido o falle la base al revocar (en ese caso
 * el error queda en el log del servidor).
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

  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', authCookieOptions(0));
  return response;
}
