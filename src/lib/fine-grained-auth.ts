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
 * Only ADMINISTRADOR can approve overrides (manual authorization decisions).
 * This check happens INSIDE the /api/socios/{id}/access-override handler, not middleware.
 *
 * @param rol The user's role
 * @returns true if the role is allowed to approve overrides
 */
export function canApproveAccessOverride(rol: UserRole): boolean {
  return rol === 'ADMINISTRADOR';
}

/**
 * Check if a user can view/edit a specific socio's data.
 * - SOCIO: only their own record
 * - INSTRUCTOR/RECEPCIONISTA/ADMINISTRADOR: all records
 *
 * @param userRole The user's role
 * @param requesterId The ID of the user making the request
 * @param resourceOwnerId The ID of the socio record being accessed
 * @returns true if access is allowed
 */
export function canAccessSocioData(
  userRole: UserRole,
  requesterId: string,
  resourceOwnerId: string
): boolean {
  if (userRole === 'SOCIO') {
    // Socio can only access their own record
    return requesterId === resourceOwnerId;
  }

  // INSTRUCTOR, RECEPCIONISTA, ADMINISTRADOR can access any socio
  return true;
}

/**
 * Check if a user can view/edit a specific rutina.
 * - SOCIO: only assigned rutinas (RutinaAsignada.activa = true)
 * - INSTRUCTOR/RECEPCIONISTA/ADMINISTRADOR: all rutinas
 *
 * @param userRole The user's role
 * @returns true if the role is allowed to access all rutinas; false means handler must filter
 */
export function canAccessAllRutinas(userRole: UserRole): boolean {
  return userRole === 'INSTRUCTOR' || userRole === 'RECEPCIONISTA' || userRole === 'ADMINISTRADOR';
}
