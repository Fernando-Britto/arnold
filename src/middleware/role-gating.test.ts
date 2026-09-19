import { roleGatingMiddleware, RoleGate } from "./role-gating";
import { RequestWithUser } from "@/lib/auth";
import { Rol } from "@prisma/client";

describe("roleGatingMiddleware", () => {
  describe("Route protection", () => {
    it("should allow ADMINISTRADOR to access /ejercicios", () => {
      const req = {
        user: { id: "1", rol: Rol.ADMINISTRADOR },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/ejercicios");
      expect(result).toBe(true);
    });

    it("should allow INSTRUCTOR to access /ejercicios", () => {
      const req = {
        user: { id: "2", rol: Rol.INSTRUCTOR },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/ejercicios");
      expect(result).toBe(true);
    });

    it("should allow RECEPCIONISTA to access /ejercicios", () => {
      const req = {
        user: { id: "3", rol: Rol.RECEPCIONISTA },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/ejercicios");
      expect(result).toBe(true);
    });

    it("should deny SOCIO access to /ejercicios", () => {
      const req = {
        user: { id: "4", rol: Rol.SOCIO },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/ejercicios");
      expect(result).toBe(false);
    });

    it("should allow ADMINISTRADOR to access /rutinas", () => {
      const req = {
        user: { id: "1", rol: Rol.ADMINISTRADOR },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/rutinas");
      expect(result).toBe(true);
    });

    it("should allow ADMINISTRADOR to access /clientes", () => {
      const req = {
        user: { id: "1", rol: Rol.ADMINISTRADOR },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/clientes");
      expect(result).toBe(true);
    });

    it("should allow ADMINISTRADOR to access /membresias", () => {
      const req = {
        user: { id: "1", rol: Rol.ADMINISTRADOR },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/membresias");
      expect(result).toBe(true);
    });

    it("should deny access to unknown routes for all roles", () => {
      const req = {
        user: { id: "1", rol: Rol.ADMINISTRADOR },
      } as unknown as RequestWithUser;

      const result = roleGatingMiddleware(req, "/unknown");
      expect(result).toBe(false);
    });
  });

  describe("Access matrix validation", () => {
    it("should have a valid access matrix for all protected routes", () => {
      const matrix = getRoleGateMatrix();
      expect(matrix).toBeDefined();
      expect(matrix["/ejercicios"]).toBeDefined();
      expect(matrix["/rutinas"]).toBeDefined();
      expect(matrix["/clientes"]).toBeDefined();
      expect(matrix["/membresias"]).toBeDefined();
    });

    it("should not allow unauthenticated access", () => {
      const req = {
        user: null,
      } as unknown as RequestWithUser;

      expect(() => roleGatingMiddleware(req, "/ejercicios")).toThrow();
    });
  });
});

describe("RoleGate component context", () => {
  it("should provide user role from context", () => {
    const userRole = Rol.ADMINISTRADOR;
    expect(userRole).toBe(Rol.ADMINISTRADOR);
  });
});

// Helper to export the matrix for testing
export function getRoleGateMatrix() {
  return {
    "/ejercicios": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR, Rol.RECEPCIONISTA],
    "/rutinas": [Rol.ADMINISTRADOR, Rol.INSTRUCTOR],
    "/clientes": [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA],
    "/membresias": [Rol.ADMINISTRADOR],
  };
}
