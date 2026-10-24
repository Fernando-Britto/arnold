import { Rol } from "@prisma/client";
import { RequestWithUser } from "@/lib/auth";

/**
 * Access matrix: route -> allowed roles
 * Defines which roles can access which protected routes
 */
export const ROLE_GATE_MATRIX: Record<string, Rol[]> = {
  "/ejercicios": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR],
  "/rutinas": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR],
  "/clientes": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA],
  "/pagos": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA], // pantalla "Registrar Pago" (T-033)
  "/cierres": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA], // pantalla "Cierre de Caja" (T-040)
  "/acceso": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA], // kiosco de check-in por DNI + PIN (T-035)
  "/membresias": [Rol.ADMINISTRADOR],
  "/maquinas": [Rol.ADMINISTRADOR],
  "/home-interno": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.RECEPCIONISTA],
  // AC-001 home-socio-portal: Home_Socio es exclusivo del Socio; el Administrador se
  // redirige a /home-interno (defensa en profundidad, D-17).
  "/home-socio": [Rol.SOCIO],
  "/api/ejercicios": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR],
  "/api/rutinas": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR],
  "/api/rutinas-asignadas": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR], // asignar rutina (T-034)
  "/api/clientes": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA],
  "/api/membresias": [Rol.ADMINISTRADOR],
  "/api/maquinas": [Rol.ADMINISTRADOR],
  "/api/membresias/activas": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA], // dropdown de Clientes (AC-004), lectura mínima
  "/api/home-interno": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.RECEPCIONISTA],
  "/api/home-socio": [Rol.ADMINISTRADOR, Rol.SOCIO],
  "/api/acceso": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA], // check-in (T-035)
  "/api/cierres": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA], // cierre de caja (T-040)
  "/api/sesiones": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.SOCIO], // sesiones de entrenamiento (T-037)
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
