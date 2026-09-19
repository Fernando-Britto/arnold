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
      '/api/socios': ['GET'], // self-only filtering in handler
      '/api/rutinas': ['GET'], // assigned only, filtering in handler
      '/api/pagos': ['GET'], // self-only filtering in handler
      '/api/sesiones': ['GET', 'POST'], // GET own sessions, POST own training session
      '/api/auth/logout': ['POST'],
    },
  },
  INSTRUCTOR: {
    paths: {
      '/api/socios': ['GET'], // see all socios
      '/api/ejercicios': ['GET', 'POST', 'PUT', 'DELETE'], // full CRUD on ejercicios
      '/api/rutinas': ['GET', 'POST', 'PUT', 'DELETE'], // full CRUD on rutinas
      '/api/sesiones': ['GET', 'PUT'], // view and update training sessions
      '/api/auth/logout': ['POST'],
    },
  },
  RECEPCIONISTA: {
    paths: {
      '/api/socios': ['GET', 'POST', 'PUT'], // view, create, and edit socios
      '/api/pagos': ['GET', 'POST'], // view and create payments
      '/api/cierres': ['GET', 'POST'], // view and create cash closures
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
