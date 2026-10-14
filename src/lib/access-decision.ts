import { hasRouteAccess, homeRouteForRole, type HttpMethod, type UserRole } from "@/lib/authorization";

export type SessionState = "none" | "invalid" | { rol: UserRole };

export type AccessDecision =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | {
      type: "json";
      status: 401 | 403;
      code: "UNAUTHENTICATED" | "TOKEN_INVALID" | "FORBIDDEN";
      message: string;
    };

// logout es público a propósito: borrar la cookie no requiere sesión válida
// refresh también: se llama justamente cuando el access token venció; la credencial es el
// refresh token (cookie aparte), que valida el propio handler (P-20).
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/refresh"];

export const isPublicPath = (p: string) =>
  PUBLIC_PATHS.some((x) => p === x || p.startsWith(`${x}/`));

/**
 * Rutas de dispositivo (T-036, D-43 propuesta 4): la pantalla de la puerta y su API se alcanzan
 * SIN sesión de usuario. La autenticación la hace `autenticarDispositivo` (token propio) dentro
 * del handler. El carve-out es a propósito angosto: `/api/dispositivos` (plural, administración)
 * NO entra y sigue exigiendo sesión de Administrador.
 */
const DEVICE_PATHS = ["/puerta", "/api/dispositivo"];

export const isDevicePath = (p: string) =>
  DEVICE_PATHS.some((x) => p === x || p.startsWith(`${x}/`));

export function decideAccess(input: {
  pathname: string;
  method: HttpMethod;
  session: SessionState;
}): AccessDecision {
  const { pathname, method, session } = input;
  if (isPublicPath(pathname)) return { type: "next" };
  if (isDevicePath(pathname)) return { type: "next" };
  const isApi = pathname.startsWith("/api/");

  if (session === "none" || session === "invalid") {
    if (isApi) {
      return session === "none"
        ? { type: "json", status: 401, code: "UNAUTHENTICATED", message: "Iniciá sesión para continuar" }
        : { type: "json", status: 401, code: "TOKEN_INVALID", message: "Tu sesión no es válida. Iniciá sesión de nuevo" };
    }
    const from = pathname === "/" ? "" : `?from=${encodeURIComponent(pathname)}`;
    return { type: "redirect", to: `/login${from}` };
  }

  if (pathname === "/") return { type: "next" };
  if (hasRouteAccess(session.rol, pathname, method).allowed) return { type: "next" };

  return isApi
    ? { type: "json", status: 403, code: "FORBIDDEN", message: "No tenés permiso para esta acción" }
    : { type: "redirect", to: homeRouteForRole(session.rol) };
}