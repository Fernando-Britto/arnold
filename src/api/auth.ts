import { Rol } from '@prisma/client';
import { prisma } from '@/lib/db';
import { comparePassword, createJWT, hashPassword } from '@/lib/auth';
import { recordAccessAttempt, type AuditContext } from '@/lib/audit';
import { findRefreshTokenByValue, issueRefreshToken, revokeRefreshChain } from '@/lib/refresh-token';

export { AUTH_COOKIE_NAME } from '@/lib/auth';
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h (spec)

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

const ERRORS = {
  VALIDATION_ERROR: { status: 400, message: 'Email y contraseña son obligatorios', recoverable: true },
  AUTH_INVALID: { status: 401, message: 'Email o contraseña incorrectos', recoverable: true },
  AUTH_DISABLED: { status: 403, message: 'Cuenta deshabilitada. Contactá al administrador.', recoverable: false },
} as const;

type ErrorCode = keyof typeof ERRORS;
export type LoginResult =
  | { status: 200; token: string; refreshToken?: string; body: { success: true; role: Rol } }
  | { status: 400 | 401 | 403; body: { code: ErrorCode; message: string; recoverable: boolean } };

export type RefreshResult =
  | { status: 204; accessToken: string; refreshToken: string }
  | { status: 401; body: { code: 'AUTH_INVALID'; message: string; recoverable: boolean } };

function fail(code: ErrorCode): LoginResult {
  const { status, message, recoverable } = ERRORS[code];
  return { status, body: { code, message, recoverable } };
}

// Hash falso para igualar el tiempo de respuesta cuando el usuario no existe
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('arnold-dummy-password'));

const UNKNOWN_CONTEXT: AuditContext = { ip: 'unknown', userAgent: 'unknown' };

export async function handleLoginRequest(body: unknown, context: AuditContext = UNKNOWN_CONTEXT): Promise<LoginResult> {
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password?.trim()) {
    return fail('VALIDATION_ERROR');
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' }, deletedAt: null },
  });

  const valid = await comparePassword(password, usuario ? usuario.password : await getDummyHash());
  // Auditoría (P-15): cada intento queda en AuditoriaAcceso; si la cuenta existe se atribuye al usuario apuntado
  if (!usuario || !valid) {
    await recordAccessAttempt({
      usuarioId: usuario?.id ?? null, accion: 'LOGIN', resultado: 'DENY', motivo: 'AUTH_INVALID', context,
    });
    return fail('AUTH_INVALID');
  }
  if (usuario.estado !== 'ACTIVO') {
    // después de validar password: no filtra estados
    await recordAccessAttempt({
      usuarioId: usuario.id, accion: 'LOGIN', resultado: 'DENY', motivo: 'AUTH_DISABLED', context,
    });
    return fail('AUTH_DISABLED');
  }

  const token = createJWT(usuario.id, SESSION_TTL_SECONDS, {
    rol: usuario.rol, email: usuario.email, nombre: usuario.nombre,
  });
  // P-20: emisión del refresh token. Es aditivo: si falla, el login (access token) igual prospera.
  let refreshToken: string | undefined;
  try {
    refreshToken = (await issueRefreshToken(usuario.id)).token;
  } catch (error) {
    console.error('[AUTH] no se pudo emitir el refresh token:', error);
  }
  await recordAccessAttempt({ usuarioId: usuario.id, accion: 'LOGIN', resultado: 'ALLOW', context });
  return { status: 200, token, refreshToken, body: { success: true, role: usuario.rol } };
}

const REFRESH_ERROR = {
  status: 401 as const,
  body: { code: 'AUTH_INVALID' as const, message: 'Sesión de refresco inválida. Iniciá sesión de nuevo.', recoverable: true },
};

/**
 * POST /api/auth/refresh (P-20). Verifica el refresh token contra la base y, si es válido, rota:
 * revoca el token usado, emite uno nuevo y renueva el access token. Si el token presentado ya
 * estaba revocado, asume robo y revoca toda la cadena vigente del usuario. 204 en éxito, 401 en
 * cualquier fallo (token ausente/expirado/revocado, usuario inexistente, deshabilitado o borrado).
 */
export async function handleRefreshRequest(refreshToken: string | undefined | null): Promise<RefreshResult> {
  const now = new Date();
  if (!refreshToken || !refreshToken.trim()) return REFRESH_ERROR;

  const stored = await findRefreshTokenByValue(refreshToken, now);
  if (!stored) return REFRESH_ERROR;

  // Reuso de un token ya rotado o revocado: se corta toda la cadena del usuario.
  if (stored.revokedAt) {
    await revokeRefreshChain(stored.usuarioId, now);
    return REFRESH_ERROR;
  }

  // Mismas validaciones que el proxy: el usuario debe existir y estar activo.
  const usuario = await prisma.usuario.findUnique({ where: { id: stored.usuarioId } });
  if (!usuario || usuario.estado !== 'ACTIVO' || usuario.deletedAt) return REFRESH_ERROR;

  const issued = await issueRefreshToken(usuario.id, now);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: now, replacedByTokenId: issued.id },
  });
  const accessToken = createJWT(usuario.id, SESSION_TTL_SECONDS, {
    rol: usuario.rol, email: usuario.email, nombre: usuario.nombre,
  });
  return { status: 204, accessToken, refreshToken: issued.token };
}
