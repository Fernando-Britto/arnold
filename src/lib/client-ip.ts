import { ipAddress } from "@vercel/functions";

/**
 * IP del cliente (P-16 / D-33). Hay dos funciones porque el riesgo es distinto:
 *
 * - `getTrustedClientIp` alimenta un CONTROL de seguridad (límite de intentos de login). Si un
 *   atacante pudiera elegir su IP, salteaba el límite cambiando un header. Por eso solo confía en
 *   la IP que fija Vercel o, si se declara con `TRUST_PROXY_HEADERS=true`, en los headers de un
 *   proxy propio y confiable que SOBRESCRIBE x-forwarded-for. Sin eso devuelve "unknown": todos
 *   comparten un contador (fail-closed; el límite se vuelve global, pero no se puede evadir).
 * - `getBestEffortClientIp` alimenta EVIDENCIA (auditoría): acepta los headers aunque se puedan
 *   falsear; lo peor que pasa es una IP mal atribuida, no una brecha.
 */
const MAX_IP_LENGTH = 64;
let warnedUnknown = false;

const clean = (value: string | null | undefined) => value?.trim().slice(0, MAX_IP_LENGTH) || undefined;

function fromProxyHeaders(request: Request): string | undefined {
  return clean(request.headers.get("x-forwarded-for")?.split(",")[0]) ?? clean(request.headers.get("x-real-ip"));
}

export function getTrustedClientIp(request: Request): string {
  const ip =
    clean(ipAddress(request)) ??
    (process.env.TRUST_PROXY_HEADERS === "true" ? fromProxyHeaders(request) : undefined);
  if (ip) return ip;

  if (process.env.NODE_ENV === "production" && !warnedUnknown) {
    warnedUnknown = true;
    console.warn(
      "[RATE LIMIT] No se pudo determinar la IP del cliente: el límite de login es GLOBAL (todos comparten un " +
        "contador). Si hay un proxy confiable adelante, definí TRUST_PROXY_HEADERS=true."
    );
  }
  return "unknown";
}

export function getBestEffortClientIp(request: Request): string {
  return clean(ipAddress(request)) ?? fromProxyHeaders(request) ?? "unknown";
}
