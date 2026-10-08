import { Rol } from '@prisma/client';
import { prisma } from '@/lib/db';
import { comparePassword, createJWT, hashPassword } from '@/lib/auth';
import { recordAccessAttempt, type AuditContext } from '@/lib/audit';

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
  | { status: 200; token: string; body: { success: true; role: Rol } }
  | { status: 400 | 401 | 403; body: { code: ErrorCode; message: string; recoverable: boolean } };

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
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
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
  await recordAccessAttempt({ usuarioId: usuario.id, accion: 'LOGIN', resultado: 'ALLOW', context });
  return { status: 200, token, body: { success: true, role: usuario.rol } };
}
