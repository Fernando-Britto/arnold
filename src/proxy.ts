import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { checkRateLimit, cleanupRateLimitLogsIfNeeded } from "@/lib/rateLimit";
import { hasRouteAccess, type HttpMethod, type UserRole } from "@/lib/authorization";
import { decideAccess, isPublicPath, isDevicePath, type SessionState } from "@/lib/access-decision";
import { AUTH_COOKIE_NAME } from "@/api/auth";
import { prisma } from "@/lib/db";
import { recordDeniedAccess } from "@/lib/audit";
import { getTrustedClientIp } from "@/lib/client-ip";
import { isTokenRevoked } from "@/lib/token-revocation";

// P-10: no hay auto-registro público; /api/auth/register ya no está acá ni en PUBLIC_PATHS.
// P-16/U: límite por IP para las rutas públicas de auth que hacen trabajo de base. `login` sigue
// en 8/min (fuerza bruta). `logout` y `refresh` también son públicas y pegan a la base, así que
// entran al límite; `refresh` se llama con más frecuencia que `login` (renovación proactiva en
// varios dispositivos detrás de un mismo NAT), por eso su umbral es más alto y no lockea a un
// cliente legítimo.
const RATE_LIMITED_AUTH: { prefix: string; limit: number }[] = [
  { prefix: "/api/auth/login", limit: 8 },
  { prefix: "/api/auth/logout", limit: 8 },
  { prefix: "/api/auth/refresh", limit: 30 },
];

export async function proxy(request: NextRequest, event?: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const method = request.method as HttpMethod;

  await cleanupRateLimitLogsIfNeeded();

  // Login/logout/refresh: límite por IP contra fuerza bruta (login 8/min; logout 8/min; refresh 30/min)
  const authRoute = RATE_LIMITED_AUTH.find((r) => pathname.startsWith(r.prefix));
  if (authRoute) {
    const ip = getTrustedClientIp(request);
    if (!(await checkRateLimit(ip, pathname, authRoute.limit))) {
      return NextResponse.json(
        { code: "RATE_LIMITED", message: "Demasiados intentos. Probá de nuevo en un minuto." },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  // T-036 (D-43 propuesta 4): la puerta y su API no usan sesión de usuario; el token del
  // dispositivo lo valida el handler (`autenticarDispositivo`). Carve-out acotado: ninguna otra
  // página ni ruta de API cambia de comportamiento.
  if (isDevicePath(pathname)) return NextResponse.next();

  // 1. Autenticación
  let session: SessionState = "none";
  let userId = "";
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    const payload = verifyJWT(token);
    // En paralelo: la consulta de revocación (P-06) no suma latencia a la del usuario
    const [user, revoked] = payload
      ? await Promise.all([
          prisma.usuario.findUnique({ where: { id: payload.sub } }),
          isTokenRevoked(payload.jti),
        ])
      : [null, false];
    if (user && user.estado === "ACTIVO" && !user.deletedAt && !revoked) {
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
  // F / P-38: la denegación NO espera la escritura de auditoría. `recordDeniedAccess` ya traga sus
  // propios errores; acá además la encadenamos a `event.waitUntil` para que sobreviva a la
  // respuesta sin sumar latencia (y sin event queda fire-and-forget).
  if (decision.type !== "next" && typeof session === "object") {
    const audit = recordDeniedAccess({ request, usuarioId: userId, method, pathname }).catch((error) => {
      console.error("[AUDIT] falló la auditoría de acceso denegado:", error);
    });
    event?.waitUntil(audit);
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