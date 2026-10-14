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

