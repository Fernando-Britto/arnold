import { handleAccessOverrideRequest } from "@/app/api/socios/[id]/access-override/route";
import { mapErrorToResponse } from "@/lib/route-error-mapper";
import { createJWT } from "@/lib/auth";
import * as accessOverride from "@/api/socios/access-override";

jest.mock("@/api/socios/access-override");
jest.mock("@/lib/db");

/**
 * Integration tests for POST /api/socios/[id]/access-override
 *
 * Tests use handleAccessOverrideRequest() exported from route.ts for testing.
 * This function contains all the route logic without NextRequest/NextResponse,
 * allowing us to test error mapping, JWT extraction, and handler invocation
 * in a Jest-compatible way.
 */

describe("POST /api/socios/[id]/access-override — Route Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication: 401 UNAUTHORIZED", () => {
    it("should return 401 UNAUTHORIZED when Authorization header is missing", async () => {
      const result = await handleAccessOverrideRequest(
        undefined, // No auth header
        { motivo: "Pago confirmado" },
        "socio-1"
      );

      expect(result.status).toBe(401);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toContain("Token");
    });

    it("should return 401 UNAUTHORIZED when Authorization token is invalid", async () => {
      const result = await handleAccessOverrideRequest(
        "Bearer invalid-token-xyz",
        { motivo: "Pago confirmado" },
        "socio-1"
      );

      expect(result.status).toBe(401);
      expect(result.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 UNAUTHORIZED when Authorization header is malformed (not Bearer)", async () => {
      const result = await handleAccessOverrideRequest(
        "Basic user:pass",
        { motivo: "Pago confirmado" },
        "socio-1"
      );

      expect(result.status).toBe(401);
      expect(result.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Role-based access control: 403 FORBIDDEN", () => {
    it("should return 403 FORBIDDEN when handleAccessOverride rejects with FORBIDDEN message", async () => {
      const token = createJWT("user-123", "7d", {
        rol: "RECEPCIONISTA",
        email: "recep@test.com",
        nombre: "Recepcionista",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockRejectedValue(
        new Error("FORBIDDEN: Rol de administrador requerido")
      );

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Pago confirmado" },
        "socio-1"
      );

      expect(result.status).toBe(403);
      expect(result.code).toBe("FORBIDDEN");
      expect(result.message).toContain("administrador");
    });
  });

  describe("Validation errors: 400 VALIDATION_ERROR", () => {
    it("should return 400 VALIDATION_ERROR when motivo is too short", async () => {
      const token = createJWT("admin-123", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockRejectedValue(
        new Error(
          "Validación fallida: La razón debe tener al menos 10 caracteres"
        )
      );

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "short" }, // 5 chars
        "socio-1"
      );

      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("10 caracteres");
    });

    it("should return 400 VALIDATION_ERROR when motivo is empty", async () => {
      const token = createJWT("admin-123", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockRejectedValue(
        new Error("Validación fallida: La razón no puede estar vacía")
      );

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "" },
        "socio-1"
      );

      expect(result.status).toBe(400);
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("vacía");
    });

    it("should clean validation error message (remove prefix)", () => {
      const mapped = mapErrorToResponse(
        new Error(
          "Validación fallida: La razón debe tener al menos 10 caracteres"
        )
      );

      expect(mapped.code).toBe("VALIDATION_ERROR");
      expect(mapped.status).toBe(400);
      expect(mapped.message).toBe(
        "La razón debe tener al menos 10 caracteres"
      );
    });
  });

  describe("Not found errors: 404 NOT_FOUND", () => {
    it("should return 404 NOT_FOUND when socio does not exist", async () => {
      const token = createJWT("admin-123", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockRejectedValue(
        new Error("NOT_FOUND: Socio no encontrado")
      );

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Pago confirmado para mañana" },
        "nonexistent-socio"
      );

      expect(result.status).toBe(404);
      expect(result.code).toBe("NOT_FOUND");
      expect(result.message).toBeDefined();
    });
  });

  describe("Server errors: 500 SERVER_ERROR", () => {
    it("should return 500 SERVER_ERROR on unhandled database error", async () => {
      const token = createJWT("admin-123", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockRejectedValue(
        new Error("Database connection timeout")
      );

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Pago confirmado para mañana" },
        "socio-1"
      );

      expect(result.status).toBe(500);
      expect(result.code).toBe("SERVER_ERROR");
    });
  });

  describe("Success: 200 OK", () => {
    it("should return 200 OK with success on valid ADMIN request", async () => {
      const token = createJWT("admin-123", "7d", {
        rol: "ADMINISTRADOR",
        email: "admin@test.com",
        nombre: "Admin",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockResolvedValue({
        success: true,
        message: "Acceso otorgado; registrado en auditoría",
      });

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Próximo pago confirmado para 2026-08-15" },
        "socio-1"
      );

      expect(result.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Acceso otorgado");
    });

    it("should call handleAccessOverride with correct parameters on success", async () => {
      const token = createJWT("admin-456", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockResolvedValue({
        success: true,
        message: "Acceso otorgado; registrado en auditoría",
      });

      await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Pago confirmado para mañana" },
        "socio-test-123"
      );

      // Verify handler was called
      expect(accessOverride.handleAccessOverride).toHaveBeenCalled();
      const callArgs = (
        accessOverride.handleAccessOverride as jest.Mock
      ).mock.calls[0];

      // Verify user data was extracted and passed
      expect(callArgs[0].user.id).toBe("admin-456");
      expect(callArgs[0].user.rol).toBe("ADMINISTRADOR");

      // Verify body was passed
      expect(callArgs[0].body.motivo).toBe("Pago confirmado para mañana");

      // Verify socio ID was passed
      expect(callArgs[1]).toBe("socio-test-123");
    });
  });

  describe("Error mapping utility function", () => {
    it("should map FORBIDDEN error to 403", () => {
      const result = mapErrorToResponse(
        new Error("FORBIDDEN: Rol de administrador requerido")
      );

      expect(result.code).toBe("FORBIDDEN");
      expect(result.status).toBe(403);
    });

    it("should map NOT_FOUND error to 404", () => {
      const result = mapErrorToResponse(new Error("NOT_FOUND: Socio no encontrado"));

      expect(result.code).toBe("NOT_FOUND");
      expect(result.status).toBe(404);
    });

    it("should map unhandled error to 500 SERVER_ERROR", () => {
      const result = mapErrorToResponse(new Error("Unexpected error"));

      expect(result.code).toBe("SERVER_ERROR");
      expect(result.status).toBe(500);
    });
  });

  describe("JWT extraction from Authorization header", () => {
    it("should extract ADMIN token and allow handler invocation", async () => {
      const token = createJWT("admin-user-123", "7d", {
        rol: "ADMINISTRADOR",
        email: "admin@example.com",
        nombre: "Admin User",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockResolvedValue({
        success: true,
        message: "Acceso otorgado",
      });

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Pago confirmado para mañana" },
        "socio-1"
      );

      // If JWT extraction worked, handleAccessOverride should have been called
      expect(accessOverride.handleAccessOverride).toHaveBeenCalled();
      expect(result.status).toBe(200);
    });

    it("should extract user role from JWT and pass to handler", async () => {
      const token = createJWT("user-xyz", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockResolvedValue({
        success: true,
        message: "Acceso otorgado",
      });

      await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Pago confirmado para mañana" },
        "socio-1"
      );

      const callArgs = (
        accessOverride.handleAccessOverride as jest.Mock
      ).mock.calls[0];
      expect(callArgs[0].user.rol).toBe("ADMINISTRADOR");
    });
  });

  describe("Route parameter handling (params as Promise)", () => {
    it("should accept socioId parameter and pass to handler", async () => {
      const token = createJWT("admin-123", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockResolvedValue({
        success: true,
        message: "Acceso otorgado",
      });

      await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "Pago confirmado para mañana" },
        "socio-unique-id-456" // This would come from await params
      );

      const callArgs = (
        accessOverride.handleAccessOverride as jest.Mock
      ).mock.calls[0];
      expect(callArgs[1]).toBe("socio-unique-id-456");
    });
  });

  describe("Spanish validation messages", () => {
    it("should preserve Spanish error messages from validation", async () => {
      const token = createJWT("admin-123", "7d", {
        rol: "ADMINISTRADOR",
      });

      (accessOverride.handleAccessOverride as jest.Mock).mockRejectedValue(
        new Error("Validación fallida: La razón no puede estar vacía")
      );

      const result = await handleAccessOverrideRequest(
        `Bearer ${token}`,
        { motivo: "" },
        "socio-1"
      );

      expect(result.message).toBe("La razón no puede estar vacía");
      expect(result.message).not.toContain("Validación fallida");
    });
  });
});
