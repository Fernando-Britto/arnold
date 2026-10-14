import { NextRequest, NextResponse } from 'next/server';
import { handleLoginRequest, AUTH_COOKIE_NAME, SESSION_TTL_SECONDS, authCookieOptions } from '@/api/auth';
import { REFRESH_COOKIE_NAME, REFRESH_TTL_SECONDS } from '@/lib/refresh-token';
import { getRequestContext } from '@/lib/audit';

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try { body = await request.json(); } catch { /* body inválido → 400 */ }

  const result = await handleLoginRequest(body, getRequestContext(request));
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.status === 200) {
    response.cookies.set(AUTH_COOKIE_NAME, result.token, authCookieOptions(SESSION_TTL_SECONDS));
    // P-20: cookie de refresh opaca (aditiva). Si la emisión falló, el login sigue igual.
    if (result.refreshToken) {
      response.cookies.set(REFRESH_COOKIE_NAME, result.refreshToken, authCookieOptions(REFRESH_TTL_SECONDS));
    }
  }
  return response;
}
