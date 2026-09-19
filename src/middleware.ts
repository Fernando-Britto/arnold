import { NextRequest, NextResponse } from 'next/server';
import { ipAddress } from '@vercel/functions';
import { verifyJWT } from '@/lib/auth';
import { checkRateLimit, cleanupRateLimitLogsIfNeeded } from '@/lib/rateLimit';
import { hasRouteAccess, type HttpMethod } from '@/lib/authorization';
import { prisma } from '@/lib/db';

const PUBLIC_AUTH_ROUTES = ['/api/auth/login', '/api/auth/register'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method as HttpMethod;

  // Trigger cleanup (1:50 chance)
  await cleanupRateLimitLogsIfNeeded();

  // Public auth routes: rate limit by IP (8 req/min for brute force protection)
  // Use pathname directly for login (no dynamic segments, won't cause grouping issues)
  if (PUBLIC_AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const clientIP = ipAddress(request) || 'unknown';
    const allowed = await checkRateLimit(clientIP, pathname, 8);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again in 1 minute.' },
        { status: 429 }
      );
    }

    return NextResponse.next();
  }

  // Protected routes: validate JWT + rate limit by user
  const token = request.cookies.get('authToken')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userId = verifyJWT(token);
  if (!userId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Fetch user from DB to verify active status + get role
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
  });

  if (!user || user.estado !== 'ACTIVO') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based access control: check if role can perform this method on this path
  // hasRouteAccess returns both allowed status AND basePath for rate limit grouping
  const access = hasRouteAccess(user.rol as any, pathname, method);
  if (!access.allowed) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  // Rate limit check (100 req/min per user for authenticated endpoints)
  // Use basePath (not pathname) so all requests to /api/socios/* group under /api/socios
  const rateLimitKey = access.basePath || pathname; // fallback to pathname if no match (shouldn't happen if access.allowed)
  const rateLimitAllowed = await checkRateLimit(userId, rateLimitKey, 100);
  if (!rateLimitAllowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  // Pass user context to route handler
  const response = NextResponse.next();
  response.headers.set('x-user-id', userId);
  response.headers.set('x-user-rol', user.rol);

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};
