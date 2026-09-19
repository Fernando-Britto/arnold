import { Rol } from "@prisma/client";
import { RequestWithUser } from "@/lib/auth";

/**
 * Access matrix: route -> allowed roles
 * Defines which roles can access which protected routes
 */
export const ROLE_GATE_MATRIX: Record<string, Rol[]> = {
  "/ejercicios": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.RECEPCIONISTA],
  "/rutinas": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR],
  "/clientes": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA],
  "/membresias": [Rol.ADMINISTRADOR],
  "/home-interno": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.RECEPCIONISTA],
  "/api/ejercicios": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.RECEPCIONISTA],
  "/api/rutinas": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR],
  "/api/clientes": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA],
  "/api/membresias": [Rol.ADMINISTRADOR],
};

/**
 * Role gating middleware: check if user has access to a route
 * @param req Request with user attached
 * @param route Route path to check
 * @returns true if user is authorized, false otherwise
 * @throws Error if user is not authenticated
 */
export function roleGatingMiddleware(req: RequestWithUser, route: string): boolean {
  if (!req.user) {
    throw new Error("User not authenticated");
  }

  const allowedRoles = ROLE_GATE_MATRIX[route];

  // If route is not in the matrix, deny access (fail-safe)
  if (!allowedRoles) {
    return false;
  }

  // Ensure user.rol is a valid Rol enum value
  const userRol = Object.values(Rol).includes(req.user.rol as Rol) ? (req.user.rol as Rol) : null;
  if (!userRol) {
    return false;
  }

  return allowedRoles.includes(userRol);
}

/**
 * Factory for role checking functions
 * Returns a function that checks if a user has a specific role
 */
export function createRoleChecker(requiredRole: Rol | Rol[]) {
  return (userRole: Rol): boolean => {
    const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return required.includes(userRole);
  };
}

/**
 * Checks if a user is an admin (ADMINISTRADOR)
 */
export function isAdmin(rol: Rol): boolean {
  return rol === Rol.ADMINISTRADOR;
}

/**
 * Checks if a user is staff (ADMINISTRADOR, INSTRUCTOR, or RECEPCIONISTA)
 * Note: SOCIO role is not considered staff
 */
export function isStaff(rol: Rol): boolean {
  const staffRoles: Rol[] = [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.RECEPCIONISTA];
  return staffRoles.includes(rol);
}

/**
 * Checks if a user is a member (SOCIO)
 */
export function isMember(rol: Rol): boolean {
  return rol === Rol.SOCIO;
}

// Type for requests with user attached
export type RoleGate = {
  user: {
    id: string;
    rol: Rol;
  } | null;
};
