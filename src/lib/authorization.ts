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
    // se quitó '/api/socios' GET y '/api/pagos' GET (B1): eran grants fantasma, los
    // handlers los rechazan y el Socio obtiene su propia data por /api/home-socio.
    // se quitó '/api/rutinas' GET: RN-06 limita Rutinas a Admin/Instructor;
    // el Socio ve su rutina vía /api/home-socio
    // PUT para finalizar la sesión de entrenamiento (D-44); GET/POST ya existían.
    '/api/sesiones': ['GET', 'POST', 'PUT'],
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
    '/api/rutinas-asignadas': ['GET', 'POST'], // asignar rutina (T-034); Admin por wildcard
    '/api/rutinas': ['GET', 'POST', 'PUT', 'DELETE'],
    '/api/sesiones': ['GET'], // N2: el Instructor solo lee sesiones; el POST/PUT los rechaza el handler
    '/api/auth/logout': ['POST'],
  },
},
RECEPCIONISTA: {
  paths: {
    '/home-interno': ['GET'],
    '/api/home-interno': ['GET'],
    '/clientes': ['GET'],
    '/pagos': ['GET'], // pantalla "Registrar Pago" (T-033); Admin la cubre por wildcard
    '/cierres': ['GET'], // pantalla "Cierre de Caja" (T-040); Admin la cubre por wildcard
    '/acceso': ['GET'], // kiosco de check-in por DNI + PIN (T-035); Admin por wildcard
    '/api/acceso': ['GET', 'POST'], // check-in (T-035)
    '/api/clientes': ['GET', 'POST', 'PUT', 'DELETE'],
    '/api/membresias/activas': ['GET'], // solo el dropdown de Clientes (AC-004); la gestión sigue siendo de Admin (RN-06)
    '/api/socios': ['GET', 'POST', 'PUT'],
    '/api/pagos': ['GET', 'POST'],
    '/api/cierres': ['GET', 'POST'],
    '/api/auth/logout': ['POST'],
  },
},
  ADMINISTRADOR: {
    paths: {
      // Excepción explícita al comodín (AC-001 home-socio-portal / D-17): /home-socio es
      // exclusivo del Socio. El comodín es laxo, así que un entry con métodos vacíos lo
      // recorta por prefijo (ver hasRouteAccess). No toca /api/home-socio ni ninguna otra ruta.
      '/home-socio': [],
      '/api/configuracion': ['GET', 'PUT'], // panel de parámetros: solo Administrador (D-54)
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

  // Find matching base path for this pathname.
  // P-41 / I: pick the LONGEST matching prefix. `Array.find` returned the first match in key
  // insertion order, so a shorter prefix (e.g. `/api/rutinas`) could shadow a longer, more
  // specific one (e.g. `/api/rutinas-asignadas`) if the object were ever reordered.
  //
  // Un entry explícito tiene prioridad sobre el comodín: permite que un rol con acceso amplio
  // (ADMINISTRADOR) recorte una ruta puntual. Ej.: `/home-socio` para ADMIN → `[]` (denegado)
  // sin debilitar el resto del wildcard (AC-001 home-socio-portal / D-17).
  const matchingPath = matchBasePath(permissions.paths, pathname);

  if (matchingPath) {
    const allowedMethods = permissions.paths[matchingPath];
    return {
      allowed: allowedMethods.includes(method),
      basePath: matchingPath,
    };
  }

  // ADMINISTRADOR wildcard (sólo cuando no hay un entry explícito más específico)
  if (permissions.paths['*']) {
    const allowed = permissions.paths['*'].includes(method);
    return {
      allowed,
      basePath: '*', // wildcard applies to all paths
    };
  }

  return {
    allowed: false,
    basePath: null,
  };
}

/**
 * Return the longest base path in `paths` that prefixes `pathname`, or null.
 * Order-independent: iterates every key and keeps the longest match.
 */
export function matchBasePath(paths: RolePathPermissions, pathname: string): string | null {
  let best: string | null = null;
  for (const basePath of Object.keys(paths)) {
    if (pathname.startsWith(basePath) && (best === null || basePath.length > best.length)) {
      best = basePath;
    }
  }
  return best;
}

export function homeRouteForRole(rol: UserRole): string {
  return rol === 'SOCIO' ? '/home-socio' : '/home-interno';
}
