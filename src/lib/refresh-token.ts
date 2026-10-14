import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { comparePassword, hashPassword } from "@/lib/auth";

/**
 * Refresh token con rotación (P-20). Extiende la sesión sin volver a pedir credenciales.
 *
 * El token es opaco: 32 bytes aleatorios en base64url. En la base se guarda **solo el hash bcrypt**
 * (nunca el token en claro), igual que `Dispositivo.tokenHash`. Como bcrypt usa salt por fila, no
 * se puede consultar por hash: para validar un token presentado se recorren los vigentes (no
 * vencidos, revocados o no) y se compara con `comparePassword`. Es aceptable para la escala de la
 * app; si el volumen creciera, convendría un patrón selector/verificador con el id en el token.
 */

/** Nombre de la cookie HttpOnly del refresh token. */
export const REFRESH_COOKIE_NAME = "authRefresh";

/** 30 días (el access token sigue durando 24 h; el refresh solo lo extiende). */
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Token opaco: 32 bytes aleatorios en base64url. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface IssuedRefreshToken {
  /** Token en claro: se setea en la cookie y NUNCA se persiste ni se loguea. */
  token: string;
  id: string;
  expiresAt: Date;
}

/**
 * Emite un refresh token nuevo para el usuario: genera el token, guarda su hash y vencimiento,
 * y devuelve el token en claro para la cookie. Lanza si falla la base (el caller decide).
 */
export async function issueRefreshToken(
  usuarioId: string,
  now: Date = new Date()
): Promise<IssuedRefreshToken> {
  const token = generateRefreshToken();
  const tokenHash = await hashPassword(token);
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000);
  const row = await prisma.refreshToken.create({ data: { usuarioId, tokenHash, expiresAt } });
  return { token, id: row.id, expiresAt };
}

export interface MatchedRefreshToken {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

/**
 * Busca la fila del token presentado entre los NO vencidos (revocados o no: se necesitan los
 * revocados para detectar reuso). Devuelve `null` si ninguno coincide o si ya venció.
 */
export async function findRefreshTokenByValue(
  token: string,
  now: Date = new Date()
): Promise<MatchedRefreshToken | null> {
  const candidates = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: now } },
  });
  for (const candidate of candidates) {
    if (await comparePassword(token, candidate.tokenHash)) return candidate;
  }
  return null;
}

/** Revoca toda la cadena vigente del usuario (detección de reuso). */
export async function revokeRefreshChain(usuarioId: string, now: Date = new Date()): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { usuarioId, revokedAt: null },
    data: { revokedAt: now },
  });
}

/**
 * Revoca el refresh token presentado (logout). `true` si se encontró una fila (aunque ya estuviera
 * revocada); `false` si no existe entre los vigentes. Lanza si falla la base.
 */
export async function revokeRefreshTokenByValue(
  token: string,
  now: Date = new Date()
): Promise<boolean> {
  const stored = await findRefreshTokenByValue(token, now);
  if (!stored) return false;
  if (!stored.revokedAt) {
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: now } });
  }
  return true;
}
