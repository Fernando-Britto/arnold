import type { AccionAcceso, ResultadoAcceso } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { getBestEffortClientIp } from "@/lib/client-ip";

/**
 * Registro de accesos en AuditoriaAcceso (spec access-audit-logging, P-15 / D-32).
 * Regla de oro: auditar NUNCA rompe ni demora de más la request. Por eso nada de acá lanza:
 * si la base falla, el detalle queda en el log del servidor y el flujo sigue.
 */
export interface AuditContext {
  ip: string;
  userAgent: string;
}

const MAX_USER_AGENT = 255;
const MAX_MOTIVO = 255;
/** Tope de filas ACCESS_DENIED por usuario y minuto (evita inundar la tabla desde una sesión válida). */
const DENIED_AUDIT_PER_MINUTE = 10;

/**
 * IP y user-agent de la request, para la auditoría. La IP es "mejor esfuerzo" (ver client-ip.ts):
 * los headers de proxy los puede falsear el cliente si no hay un proxy confiable adelante.
 */
export function getRequestContext(request: Request): AuditContext {
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, MAX_USER_AGENT);
  return { ip: getBestEffortClientIp(request), userAgent };
}

export async function recordAccessAttempt(entry: {
  usuarioId?: string | null;
  accion: AccionAcceso;
  resultado: ResultadoAcceso;
  motivo?: string | null;
  context: AuditContext;
}): Promise<void> {
  try {
    await prisma.auditoriaAcceso.create({
      data: {
        usuarioId: entry.usuarioId ?? null,
        accion: entry.accion,
        resultado: entry.resultado,
        motivo: entry.motivo ? entry.motivo.slice(0, MAX_MOTIVO) : null,
        ipAddress: entry.context.ip,
        userAgent: entry.context.userAgent,
      },
    });
  } catch (error) {
    console.error("[AUDIT] no se pudo registrar el acceso:", error);
  }
}

/**
 * Acceso denegado por permisos (RBAC) a un usuario con sesión válida. Solo se llama con sesión
 * válida: sin sesión no hay actor al que atribuirlo y registrarlo permitiría inundar la tabla.
 * `pathname` no incluye la query string (no se guardan tokens ni parámetros).
 */
export async function recordDeniedAccess(input: {
  request: Request;
  usuarioId: string;
  method: string;
  pathname: string;
}): Promise<void> {
  try {
    if (!(await checkRateLimit(input.usuarioId, "audit:access-denied", DENIED_AUDIT_PER_MINUTE))) return;
    await recordAccessAttempt({
      usuarioId: input.usuarioId,
      accion: "ACCESS_DENIED",
      resultado: "DENY",
      motivo: `${input.method} ${input.pathname}`,
      context: getRequestContext(input.request),
    });
  } catch (error) {
    console.error("[AUDIT] no se pudo registrar el acceso denegado:", error);
  }
}
