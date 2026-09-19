import { hasRouteAccess } from "./authorization";

describe("Authorization Matrix", () => {
  describe("SOCIO role", () => {
    it("should allow SOCIO to GET /api/socios", () => {
      const result = hasRouteAccess("SOCIO", "/api/socios", "GET");
      expect(result.allowed).toBe(true);
      expect(result.basePath).toBe("/api/socios");
    });

    it("should deny SOCIO to POST /api/socios", () => {
      const result = hasRouteAccess("SOCIO", "/api/socios", "POST");
      expect(result.allowed).toBe(false);
    });

    it("should allow SOCIO to GET /api/rutinas", () => {
      const result = hasRouteAccess("SOCIO", "/api/rutinas", "GET");
      expect(result.allowed).toBe(true);
    });

    it("should deny SOCIO to POST /api/rutinas", () => {
      const result = hasRouteAccess("SOCIO", "/api/rutinas", "POST");
      expect(result.allowed).toBe(false);
    });

    it("should allow SOCIO to GET /api/pagos", () => {
      const result = hasRouteAccess("SOCIO", "/api/pagos", "GET");
      expect(result.allowed).toBe(true);
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

    it("should allow INSTRUCTOR GET and PUT on /api/sesiones", () => {
      expect(hasRouteAccess("INSTRUCTOR", "/api/sesiones", "GET").allowed).toBe(true);
      expect(hasRouteAccess("INSTRUCTOR", "/api/sesiones", "PUT").allowed).toBe(true);
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
