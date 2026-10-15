import { hasRouteAccess, homeRouteForRole, matchBasePath, type RolePathPermissions } from "./authorization";

describe("homeRouteForRole", () => {
  it("homeRouteForRole", () => {
    expect(homeRouteForRole("SOCIO")).toBe("/home-socio");
    expect(homeRouteForRole("ADMINISTRADOR")).toBe("/home-interno");
  });
});

describe("Authorization Matrix", () => {
  describe("SOCIO role", () => {
    it("should deny SOCIO to GET /api/socios (los handlers lo rechazan; usa /api/home-socio)", () => {
      const result = hasRouteAccess("SOCIO", "/api/socios", "GET");
      expect(result.allowed).toBe(false);
      expect(result.basePath).toBeNull();
    });

    it("should deny SOCIO to POST /api/socios", () => {
      const result = hasRouteAccess("SOCIO", "/api/socios", "POST");
      expect(result.allowed).toBe(false);
    });

    it("should deny SOCIO to GET /api/rutinas (RN-06: Rutinas solo Admin/Instructor)", () => {
  const result = hasRouteAccess("SOCIO", "/api/rutinas", "GET");
  expect(result.allowed).toBe(false);
});

    it("should deny SOCIO to POST /api/rutinas", () => {
      const result = hasRouteAccess("SOCIO", "/api/rutinas", "POST");
      expect(result.allowed).toBe(false);
    });

    it("should deny SOCIO to GET /api/pagos (sus pagos salen de /api/home-socio)", () => {
      const result = hasRouteAccess("SOCIO", "/api/pagos", "GET");
      expect(result.allowed).toBe(false);
    });

    it("should allow SOCIO to POST /api/sesiones", () => {
      const result = hasRouteAccess("SOCIO", "/api/sesiones", "POST");
      expect(result.allowed).toBe(true);
    });

    it("should allow SOCIO to POST /api/auth/logout", () => {
      const result = hasRouteAccess("SOCIO", "/api/auth/logout", "POST");
      expect(result.allowed).toBe(true);
    });

    it("should deny SOCIO to access /api/membresias", () => {
      const result = hasRouteAccess("SOCIO", "/api/membresias", "GET");
      expect(result.allowed).toBe(false);
      expect(result.basePath).toBeNull();
    });
  });

  describe("INSTRUCTOR role", () => {
    it("should allow INSTRUCTOR full CRUD on /api/ejercicios", () => {
      expect(hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "GET").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "POST").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "PUT").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "DELETE").allowed).toBe(true);
    });

    it("should allow INSTRUCTOR full CRUD on /api/rutinas", () => {
      expect(hasRouteAccess("INSTRUCTOR", "/api/rutinas", "GET").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/rutinas", "POST").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/rutinas", "PUT").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/rutinas", "DELETE").allowed).toBe(true);
    });

    it("should allow INSTRUCTOR to GET /api/socios", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/socios", "GET");
      expect(result.allowed).toBe(true);
    });

    it("should deny INSTRUCTOR to POST /api/socios", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/socios", "POST");
      expect(result.allowed).toBe(false);
    });

    it("should allow INSTRUCTOR GET but NOT PUT on /api/sesiones (N2)", () => {
      expect(hasRouteAccess("INSTRUCTOR", "/api/sesiones", "GET").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/sesiones", "PUT").allowed).toBe(false);
    });

    it("la matriz no le da PUT al INSTRUCTOR en /api/sesiones/[id] (N2)", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/sesiones/s1", "PUT");
      expect(result.allowed).toBe(false);
      expect(result.basePath).toBe("/api/sesiones");
    });

    it("should deny INSTRUCTOR DELETE on /api/sesiones", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/sesiones", "DELETE");
      expect(result.allowed).toBe(false);
    });

    it("should deny INSTRUCTOR to /api/membresias", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/membresias", "GET");
      expect(result.allowed).toBe(false);
    });
  });

  describe("RECEPCIONISTA role", () => {
    it("should allow RECEPCIONISTA GET, POST, PUT on /api/socios", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/api/socios", "GET").allowed).toBe(true);
      expect(hasRouteAccess("RECEPCIONISTA", "/api/socios", "POST").allowed).toBe(true);
      expect(hasRouteAccess("RECEPCIONISTA", "/api/socios", "PUT").allowed).toBe(true);
    });

    it("should deny RECEPCIONISTA DELETE on /api/socios", () => {
      const result = hasRouteAccess("RECEPCIONISTA", "/api/socios", "DELETE");
      expect(result.allowed).toBe(false);
    });

    it("should allow RECEPCIONISTA GET and POST on /api/pagos", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/api/pagos", "GET").allowed).toBe(true);
      expect(hasRouteAccess("RECEPCIONISTA", "/api/pagos", "POST").allowed).toBe(true);
    });

    it("should deny RECEPCIONISTA to /api/ejercicios", () => {
      const result = hasRouteAccess("RECEPCIONISTA", "/api/ejercicios", "GET");
      expect(result.allowed).toBe(false);
    });

    it("should allow RECEPCIONISTA on /api/cierres", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/api/cierres", "GET").allowed).toBe(true);
      expect(hasRouteAccess("RECEPCIONISTA", "/api/cierres", "POST").allowed).toBe(true);
    });

    it("should allow RECEPCIONISTA to open the /cierres page", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/cierres", "GET").allowed).toBe(true);
    });
  });

  describe("ADMINISTRADOR role (wildcard)", () => {
    it("should allow ADMINISTRADOR all methods on any path", () => {
      expect(hasRouteAccess("ADMINISTRADOR", "/api/socios", "GET").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/socios", "POST").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/socios", "PUT").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/socios", "DELETE").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/socios", "PATCH").allowed).toBe(true);
    });

    it("should allow ADMINISTRADOR on /api/ejercicios", () => {
      expect(hasRouteAccess("ADMINISTRADOR", "/api/ejercicios", "GET").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/ejercicios", "DELETE").allowed).toBe(true);
    });

    it("should allow ADMINISTRADOR on /api/membresias", () => {
      expect(hasRouteAccess("ADMINISTRADOR", "/api/membresias", "GET").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/membresias", "POST").allowed).toBe(true);
    });

    it("should allow ADMINISTRADOR on unknown paths", () => {
      const result = hasRouteAccess("ADMINISTRADOR", "/api/unknown/path", "GET");
      expect(result.allowed).toBe(true);
      expect(result.basePath).toBe("*");
    });

    it("NIEGA ADMINISTRADOR en la página /home-socio (AC-001 home-socio-portal / D-17)", () => {
      const result = hasRouteAccess("ADMINISTRADOR", "/home-socio", "GET");
      expect(result.allowed).toBe(false);
      expect(result.basePath).toBe("/home-socio");
    });

    it("el comodín sigue intacto para el resto de las rutas (incl. /api/home-socio)", () => {
      expect(hasRouteAccess("ADMINISTRADOR", "/api/home-socio", "GET").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/clientes", "GET").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/clientes", "DELETE").allowed).toBe(true);
    });
  });

  describe("Página /pagos (T-033)", () => {
    it("should allow RECEPCIONISTA to GET /pagos", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/pagos", "GET").allowed).toBe(true);
    });

    it("should deny INSTRUCTOR and SOCIO to GET /pagos", () => {
      expect(hasRouteAccess("INSTRUCTOR", "/pagos", "GET").allowed).toBe(false);
      expect(hasRouteAccess("SOCIO", "/pagos", "GET").allowed).toBe(false);
    });

    it("should allow ADMINISTRADOR to GET /pagos via the wildcard", () => {
      expect(hasRouteAccess("ADMINISTRADOR", "/pagos", "GET").allowed).toBe(true);
    });
  });

  describe("Asignar rutina /api/rutinas-asignadas (T-034)", () => {
    it("should allow INSTRUCTOR to GET and POST /api/rutinas-asignadas", () => {
      expect(hasRouteAccess("INSTRUCTOR", "/api/rutinas-asignadas", "GET").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/rutinas-asignadas", "POST").allowed).toBe(true);
    });

    it("should deny RECEPCIONISTA to /api/rutinas-asignadas", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/api/rutinas-asignadas", "GET").allowed).toBe(false);
      expect(hasRouteAccess("RECEPCIONISTA", "/api/rutinas-asignadas", "POST").allowed).toBe(false);
    });

    it("should deny SOCIO to /api/rutinas-asignadas", () => {
      expect(hasRouteAccess("SOCIO", "/api/rutinas-asignadas", "GET").allowed).toBe(false);
    });

    it("should allow ADMINISTRADOR via the wildcard", () => {
      expect(hasRouteAccess("ADMINISTRADOR", "/api/rutinas-asignadas", "POST").allowed).toBe(true);
    });
  });

  describe("Kiosco de acceso /acceso y /api/acceso (T-035)", () => {
    it("should allow RECEPCIONISTA GET /acceso and POST /api/acceso", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/acceso", "GET").allowed).toBe(true);
      expect(hasRouteAccess("RECEPCIONISTA", "/api/acceso", "GET").allowed).toBe(true);
      expect(hasRouteAccess("RECEPCIONISTA", "/api/acceso/check-in", "POST").allowed).toBe(true);
    });

    it("should deny INSTRUCTOR and SOCIO to the access kiosk", () => {
      expect(hasRouteAccess("INSTRUCTOR", "/acceso", "GET").allowed).toBe(false);
      expect(hasRouteAccess("SOCIO", "/acceso", "GET").allowed).toBe(false);
      expect(hasRouteAccess("INSTRUCTOR", "/api/acceso/check-in", "POST").allowed).toBe(false);
      expect(hasRouteAccess("SOCIO", "/api/acceso/check-in", "POST").allowed).toBe(false);
    });

    it("should allow ADMINISTRADOR via the wildcard", () => {
      expect(hasRouteAccess("ADMINISTRADOR", "/acceso", "GET").allowed).toBe(true);
      expect(hasRouteAccess("ADMINISTRADOR", "/api/acceso/check-in", "POST").allowed).toBe(true);
    });
  });

  describe("Sesiones de entrenamiento /api/sesiones (T-037, D-44)", () => {
    it("should allow SOCIO to GET, POST and PUT on /api/sesiones", () => {
      expect(hasRouteAccess("SOCIO", "/api/sesiones", "GET").allowed).toBe(true);
      expect(hasRouteAccess("SOCIO", "/api/sesiones", "POST").allowed).toBe(true);
      expect(hasRouteAccess("SOCIO", "/api/sesiones", "PUT").allowed).toBe(true);
    });

    it("should match the series sub-route under the /api/sesiones base path", () => {
      const result = hasRouteAccess("SOCIO", "/api/sesiones/s1/series", "POST");
      expect(result.allowed).toBe(true);
      expect(result.basePath).toBe("/api/sesiones");
    });

    it("should deny SOCIO to DELETE on /api/sesiones", () => {
      expect(hasRouteAccess("SOCIO", "/api/sesiones", "DELETE").allowed).toBe(false);
    });

    it("should deny RECEPCIONISTA on /api/sesiones", () => {
      expect(hasRouteAccess("RECEPCIONISTA", "/api/sesiones", "GET").allowed).toBe(false);
    });
  });

  describe("Base path matching", () => {
    it("should match /api/socios for exact path", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/socios", "GET");
      expect(result.basePath).toBe("/api/socios");
    });

    it("should match /api/socios for subpaths", () => {
      const result = hasRouteAccess("RECEPCIONISTA", "/api/socios/123", "GET");
      expect(result.allowed).toBe(true);
      expect(result.basePath).toBe("/api/socios");
    });

    it("should match /api/ejercicios for subpaths with ID", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/ejercicios/456", "PUT");
      expect(result.allowed).toBe(true);
      expect(result.basePath).toBe("/api/ejercicios");
    });

    it("should not match similar but different paths", () => {
      const result = hasRouteAccess("SOCIO", "/api/socio", "GET"); // Note: singular vs plural
      expect(result.allowed).toBe(false);
      expect(result.basePath).toBeNull();
    });

    it("should return null basePath for denied access", () => {
      const result = hasRouteAccess("SOCIO", "/api/membresias", "GET");
      expect(result.allowed).toBe(false);
      expect(result.basePath).toBeNull();
    });
  });

  describe("P-41 / I — el prefijo más largo gana, sin depender del orden", () => {
    it("matchBasePath elige el prefijo más largo aunque el corto esté primero", () => {
      const paths: RolePathPermissions = { "/api/rutinas": ["GET"], "/api/rutinas-asignadas": ["POST"] };
      expect(matchBasePath(paths, "/api/rutinas-asignadas")).toBe("/api/rutinas-asignadas");
      expect(matchBasePath(paths, "/api/rutinas/7")).toBe("/api/rutinas");
      expect(matchBasePath(paths, "/api/otra")).toBeNull();
    });

    it("hasRouteAccess usa el prefijo más largo: DELETE /api/rutinas-asignadas queda en su basePath y se niega", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/rutinas-asignadas", "DELETE");
      expect(result.basePath).toBe("/api/rutinas-asignadas");
      expect(result.allowed).toBe(false);
    });
  });

  describe("HTTP method validation", () => {
    it("should support GET method", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "GET");
      expect(result.allowed).toBe(true);
    });

    it("should support POST method", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "POST");
      expect(result.allowed).toBe(true);
    });

    it("should support PUT method", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "PUT");
      expect(result.allowed).toBe(true);
    });

    it("should support DELETE method", () => {
      const result = hasRouteAccess("INSTRUCTOR", "/api/ejercicios", "DELETE");
      expect(result.allowed).toBe(true);
    });

    it("should support PATCH method for ADMINISTRADOR", () => {
      const result = hasRouteAccess("ADMINISTRADOR", "/api/socios", "PATCH");
      expect(result.allowed).toBe(true);
    });
  });
});
