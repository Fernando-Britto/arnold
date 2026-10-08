import { prisma } from "@/lib/db";
import type { JWTPayload } from "@/lib/auth";

/**
 * Revocación de tokens (P-06 / D-34). El JWT dura 24 h y es sin estado: sin esto, cerrar sesión solo
 * borraba la cookie y una copia robada del token seguía valiendo. Ahora el logout guarda el `jti`
 * del token y el proxy rechaza cualquier token cuyo `jti` esté en la tabla.
 * Cada fila guarda el vencimiento del token: pasado ese momento el token ya no verifica y la fila
 * se puede borrar (cleanupExpiredRevocations).
 */

/** Revoca el token. `true` si quedó revocado; `false` si no se puede (sin jti o sin exp). Lanza si falla la base. */
export async function revokeToken(payload: Pick<JWTPayload, "sub" | "jti" | "exp">): Promise<boolean> {
  if (!payload.jti || !payload.exp) return false;
  await prisma.tokenRevocation.upsert({
    where: { jti: payload.jti },
    update: {},
    create: { jti: payload.jti, usuarioId: payload.sub, expiraEn: new Date(payload.exp * 1000) },
  });
  return true;
}

export async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  const row = await prisma.tokenRevocation.findUnique({ where: { jti }, select: { jti: true } });
  return row !== null;
}

/** Borra las revocaciones de tokens que ya vencieron. Nunca lanza. */
export async function cleanupExpiredRevocations(now: Date = new Date()): Promise<void> {
  try {
    await prisma.tokenRevocation.deleteMany({ where: { expiraEn: { lt: now } } });
  } catch (error) {
    console.error("[TOKEN REVOCATION] no se pudo limpiar las revocaciones vencidas:", error);
  }
}
