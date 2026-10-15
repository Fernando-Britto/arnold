import { UserRole } from '@/lib/authorization';

/**
 * Fine-grained authorization checks for specific handler scenarios.
 * These are NOT middleware-level checks; they enforce business rules INSIDE route handlers.
 *
 * Pattern:
 *   1. Middleware checks coarse-grained access (role + path prefix + method)
 *   2. Handler checks fine-grained access (specific resource ownership, data-dependent rules, etc.)
 *
 * Example:
 *   - Middleware: "Can Recepcionista POST /api/socios?" → Yes
 *   - Handler (override approval): "Can this user approve an override?" → Only ADMINISTRADOR, checked here
 */

/**
 * Check if a role is allowed to approve access overrides.
 * Only ADMINISTRADOR can approve overrides (manual authorization decisions), including a
 * BLOQUEADA account: the Recepcionista (kiosco) cannot override a block (P-24).
 * This check happens INSIDE the /api/socios/{id}/access-override handler, not middleware.
 *
 * @param rol The user's role
 * @returns true if the role is allowed to approve overrides
 */
export function canApproveAccessOverride(rol: UserRole): boolean {
  return rol === 'ADMINISTRADOR';
}

/**
 * Rol vigente leído de la base. El JWT firma el rol al emitirse, así que puede estar viejo (T):
 * un usuario degradado de ADMINISTRADOR sigue con el rol viejo hasta que vence el token (24 h).
 * Devuelve el rol solo si la cuenta está ACTIVA y no dada de baja; si no, null (sesión no válida).
 *
 * Import diferido de Prisma, igual que `src/lib/configuracion.ts`: este módulo llega al navegador
 * (vía `src/api/socios/access-override.ts`) y no puede arrastrar el cliente.
 */
export async function rolVigente(usuarioId: string): Promise<UserRole | null> {
  const { prisma } = await import('@/lib/db');
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { rol: true, estado: true, deletedAt: true },
  });
  if (!usuario || usuario.estado !== 'ACTIVO' || usuario.deletedAt) return null;
  return usuario.rol as UserRole;
}

