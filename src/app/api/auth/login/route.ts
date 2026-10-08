import { NextRequest, NextResponse } from 'next/server';
import { handleLoginRequest, AUTH_COOKIE_NAME, SESSION_TTL_SECONDS, authCookieOptions } from '@/api/auth';
import { getRequestContext } from '@/lib/audit';

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try { body = await request.json(); } catch { /* body inválido → 400 */ }

  const result = await handleLoginRequest(body, getRequestContext(request));
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.status === 200) {
    response.cookies.set(AUTH_COOKIE_NAME, result.token, authCookieOptions(SESSION_TTL_SECONDS));
  }
  return response;
}
