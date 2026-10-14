import { homeRouteForRole, type UserRole } from "@/lib/authorization";

/**
 * P-09: el proxy manda a `/login?from=<ruta>` cuando una página protegida pide sesión. Al volver
 * del login hay que respetar ese destino, pero SOLO si es una ruta relativa del mismo origen:
 * un `from` absoluto (`https://…`) o protocol-relative (`//host`) convertiría el login en un
 * open redirect. Un backslash también se rechaza porque los navegadores lo normalizan a `/`.
 */

// Caracteres de control: permitirían inyectar cabeceras o cortar la URL.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function safeRedirectTarget(from: string | null | undefined): string | null {
  if (!from) return null;
  if (!from.startsWith("/")) return null; // debe ser una ruta absoluta del sitio
  if (from.startsWith("//")) return null; // protocol-relative → otro host
  if (from.includes("\\")) return null; // el navegador trata "\" como "/"
  if (CONTROL_CHARS.test(from)) return null;
  return from;
}

/** Destino post-login: el `from` seguro si existe, si no el home del rol. */
export function postLoginRoute(from: string | null | undefined, role: UserRole): string {
  return safeRedirectTarget(from) ?? homeRouteForRole(role);
}
