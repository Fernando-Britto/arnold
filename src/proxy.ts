import { NextRequest, NextResponse } from "next/server";
import { ipAddress } from "@vercel/functions";
import { verifyJWT } from "@/lib/auth";
import { checkRateLimit, cleanupRateLimitLogsIfNeeded } from "@/lib/rateLimit";
import { hasRouteAccess, type HttpMethod, type UserRole } from "@/lib/authorization";
import { decideAccess, isPublicPath, type SessionState } from "@/lib/access-decision";
import { AUTH_COOKIE_NAME } from "@/api/auth";
import { prisma } from "@/lib/db";
import { recordDeniedAccess } from "@/lib/audit";

const RATE_LIMITED_AUTH = ["/api/auth/login", "/api/auth/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method as HttpMethod;

  await cleanupRateLimitLogsIfNeeded();

  // Login/registro: límite por IP contra fuerza bruta (8 por minuto)
  if (RATE_LIMITED_AUTH.some((r) => pathname.startsWith(r))) {
    const ip = ipAddress(request) || "unknown";
    if (!(await checkRateLimit(ip, pathname, 8))) {
      return NextResponse.json(
        { code: "RATE_LIMITED", message: "Demasiados intentos. Probá de nuevo en un minuto." },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  // 1. Autenticación
  let session: SessionState = "none";
  let userId = "";
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    const payload = verifyJWT(token);
    const user = payload ? await prisma.usuario.findUnique({ where: { id: payload.sub } }) : null;
    if (user && user.estado === "ACTIVO" && !user.deletedAt) {
      session = { rol: user.rol as UserRole };
      userId = user.id;
    } else {
      session = "invalid";
    }
  }

  // 2. Autorización
  const decision = decideAccess({ pathname, method, session });
  // P-15: usuario con sesión válida al que se le niega una ruta → AuditoriaAcceso (ACCESS_DENIED).
  // Sin sesión (401) no se registra: no hay actor y se podría inundar la tabla.
  if (decision.type !== "next" && typeof session === "object") {
    await recordDeniedAccess({ request, usuarioId: userId, method, pathname });
  }
  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  if (decision.type === "json") {
    return NextResponse.json({ code: decision.code, message: decision.message }, { status: decision.status });
  }

  // 3. Rate limit por usuario, solo en la API (los prefetch de páginas no cuentan)
  const response = NextResponse.next();
  if (typeof session === "object") {
    if (pathname.startsWith("/api/")) {
      const key = hasRouteAccess(session.rol, pathname, method).basePath || pathname;
      if (!(await checkRateLimit(userId, key, 100))) {
        return NextResponse.json(
          { code: "RATE_LIMITED", message: "Demasiadas solicitudes. Probá de nuevo en un minuto." },
          { status: 429 }
        );
      }
    }
  }
  return response;
}

export const config = {
  // Todas las rutas salvo internas de Next y archivos estáticos
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};