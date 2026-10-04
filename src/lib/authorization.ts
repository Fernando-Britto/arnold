export type UserRole = 'SOCIO' | 'INSTRUCTOR' | 'RECEPCIONISTA' | 'ADMINISTRADOR';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RolePathPermissions {
  [path: string]: HttpMethod[]; // base path → allowed methods
}

export interface RolePermissions {
  paths: RolePathPermissions;
}

export interface RouteAccessResult {
  allowed: boolean;
  basePath: string | null; // matched base path (e.g., /api/socios), for rate limiting grouping
}

/**
 * Authorization matrix: Role → Path → Allowed HTTP Methods
 * 
 * Path matching uses startsWith() on base segments (e.g., /api/socios, /api/rutinas)
 * '*' means wildcard access to all methods on all paths
 */
const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  SOCIO: {
  paths: {
    '/home-socio': ['GET'],
    '/api/home-socio': ['GET'],
    '/api/socios': ['GET'],
    // se quitó '/api/rutinas' GET: RN-06 limita Rutinas a Admin/Instructor;
    // el Socio ve su rutina vía /api/home-socio
    '/api/pagos': ['GET'],
    '/api/sesiones': ['GET', 'POST'],
    '/api/auth/logout': ['POST'],
  },
},
INSTRUCTOR: {
  paths: {
    '/home-interno': ['GET'],
    '/api/home-interno': ['GET'],
    '/ejercicios': ['GET'],
    '/rutinas': ['GET'],
    '/api/socios': ['GET'],
    '/api/ejercicios': ['GET', 'POST', 'PUT', 'DELETE'],
    '/api/rutinas': ['GET', 'POST', 'PUT', 'DELETE'],
    '/api/sesiones': ['GET', 'PUT'],
    '/api/auth/logout': ['POST'],
  },
},
RECEPCIONISTA: {
  paths: {
    '/home-interno': ['GET'],
    '/api/home-interno': ['GET'],
    '/clientes': ['GET'],
    '/api/clientes': ['GET', 'POST', 'PUT', 'DELETE'],
    '/api/socios': ['GET', 'POST', 'PUT'],
    '/api/pagos': ['GET', 'POST'],
    '/api/cierres': ['GET', 'POST'],
    '/api/auth/logout': ['POST'],
  },
},
  ADMINISTRADOR: {
    paths: {
      '*': ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // wildcard: all methods on all routes
    },
  },
};

/**
 * Check if a role can perform a specific HTTP method on a path
 * @param rol User role
 * @param pathname Request pathname (e.g., /api/socios/123)
 * @param method HTTP method (GET, POST, etc.)
 * @returns RouteAccessResult with allowed status and matched basePath (for rate limiting grouping)
 *
 * ⚠️ IMPORTANT: This matrix enforces path-level (prefix-based) access control.
 * Fine-grained restrictions (e.g., "only ADMIN can approve overrides") must be
 * checked INSIDE the route handler, NOT in the middleware. Example:
 *
 *   - Recepcionista has POST /api/socios → but /api/socios/{id}/access-override
 *     must validate rol === 'ADMINISTRADOR' inside the handler logic.
 *   - Socio has GET /api/socios → but fetches only own record via handler filtering.
 *
 * This keeps authorization concerns where they belong: business logic in handlers,
 * coarse-grained access control in middleware.
 */
export function hasRouteAccess(
  rol: UserRole,
  pathname: string,
  method: HttpMethod
): RouteAccessResult {
  const permissions = ROLE_PERMISSIONS[rol];

  // ADMINISTRADOR wildcard check
  if (permissions.paths['*']) {
    const allowed = permissions.paths['*'].includes(method);
    return {
      allowed,
      basePath: '*', // wildcard applies to all paths
    };
  }

  // Find matching base path for this pathname
  const matchingPath = Object.keys(permissions.paths).find((basePath) =>
    pathname.startsWith(basePath)
  );

  if (!matchingPath) {
    return {
      allowed: false,
      basePath: null,
    };
  }

  const allowedMethods = permissions.paths[matchingPath];
  const allowed = allowedMethods.includes(method);

  return {
    allowed,
    basePath: matchingPath,
  };
}

export function homeRouteForRole(rol: UserRole): string {
  return rol === 'SOCIO' ? '/home-socio' : '/home-interno';
}
