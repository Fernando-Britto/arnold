import {
  validateAccessOverride,
  handleAccessOverride,
  requestAccessOverride,
} from "./access-override";
import * as fineGrainedAuth from "@/lib/fine-grained-auth";

jest.mock("@/lib/fine-grained-auth");
jest.mock("@/lib/db");

describe("Access Override Authorization (T-025)", () => {
  describe("Validation", () => {
    it("should accept valid override request with proper reason", () => {
      const validation = validateAccessOverride({
        motivo: "Próximo pago confirmado para 2026-08-15",
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject empty motivo", () => {
      const validation = validateAccessOverride({
        motivo: "",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("La razón no puede estar vacía");
    });

    it("should reject motivo with only whitespace", () => {
      const validation = validateAccessOverride({
        motivo: "   ",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("La razón no puede estar vacía");
    });

    it("should reject motivo shorter than 10 chars", () => {
      const validation = validateAccessOverride({
        motivo: "Pago OK",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "La razón debe tener al menos 10 caracteres"
      );
    });

    it("should accept motivo exactly 10 chars", () => {
      const validation = validateAccessOverride({
        motivo: "1234567890",
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject motivo longer than 500 chars", () => {
      const longMotivo = "a".repeat(501);
      const validation = validateAccessOverride({
        motivo: longMotivo,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "La razón no puede exceder 500 caracteres"
      );
    });

    it("should accept motivo exactly 500 chars", () => {
      const validation = validateAccessOverride({
        motivo: "a".repeat(500),
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should reject missing motivo field", () => {
      const validation = validateAccessOverride({});

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("La razón es requerida");
    });

    it("should reject null motivo", () => {
      const validation = validateAccessOverride({
        motivo: null,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("La razón es requerida");
    });

    it("should reject non-string motivo", () => {
      const validation = validateAccessOverride({
        motivo: 123,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("La razón es requerida");
    });
  });

  describe("Handler (mocked)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should throw FORBIDDEN for non-ADMIN user", async () => {
      (fineGrainedAuth.canApproveAccessOverride as jest.Mock).mockReturnValue(
        false
      );

      const mockReq = {
        user: { id: "user1", rol: "RECEPCIONISTA" },
        body: { motivo: "Payment confirmed" },
        ip: "192.168.1.1",
        headers: { "user-agent": "Mozilla/5.0" },
      } as any;

      await expect(
        handleAccessOverride(mockReq, "socio1")
      ).rejects.toThrow("Rol de administrador requerido");
    });

    it("should throw validation error on invalid motivo", async () => {
      (fineGrainedAuth.canApproveAccessOverride as jest.Mock).mockReturnValue(
        true
      );

      const mockReq = {
        user: { id: "admin1", rol: "ADMINISTRADOR" },
        body: { motivo: "short" },
        ip: "192.168.1.1",
        headers: { "user-agent": "Mozilla/5.0" },
      } as any;

      await expect(
        handleAccessOverride(mockReq, "socio1")
      ).rejects.toThrow("Validación fallida");
    });
  });

  describe("API call wrapper", () => {
    it("should throw error if fetch fails", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: "No se pudo otorgar acceso",
        }),
      });

      await expect(
        requestAccessOverride("socio1", "Pago confirmado para mañana")
      ).rejects.toThrow("No se pudo otorgar acceso");
    });

    it("should return success message on valid request", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Acceso otorgado; registrado en auditoría",
        }),
      });

      const result = await requestAccessOverride(
        "socio1",
        "Pago confirmado para mañana"
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("Acceso otorgado");
    });
  });

  describe("Spanish messages", () => {
    it("all validation errors are in Spanish", () => {
      const cases = [
        { data: { motivo: "" }, expected: "La razón no puede estar vacía" },
        { data: { motivo: "short" }, expected: "al menos 10 caracteres" },
        { data: { motivo: "a".repeat(501) }, expected: "no puede exceder 500" },
      ];

      cases.forEach(({ data, expected }) => {
        const validation = validateAccessOverride(data);
        const allSpanish = validation.errors.every((msg) =>
          msg.includes(expected) || msg.includes("La razón")
        );
        expect(allSpanish).toBe(true);
      });
    });
  });
});
