import {
  canApproveAccessOverride,
  canAccessSocioData,
  canAccessAllRutinas,
} from "./fine-grained-auth";

describe("Fine-grained Authorization", () => {
  describe("canApproveAccessOverride", () => {
    it("should allow ADMINISTRADOR to approve overrides", () => {
      const result = canApproveAccessOverride("ADMINISTRADOR");
      expect(result).toBe(true);
    });

    it("should deny INSTRUCTOR from approving overrides", () => {
      const result = canApproveAccessOverride("INSTRUCTOR");
      expect(result).toBe(false);
    });

    it("should deny RECEPCIONISTA from approving overrides", () => {
      const result = canApproveAccessOverride("RECEPCIONISTA");
      expect(result).toBe(false);
    });

    it("should deny SOCIO from approving overrides", () => {
      const result = canApproveAccessOverride("SOCIO");
      expect(result).toBe(false);
    });
  });

  describe("canAccessSocioData", () => {
    it("should allow SOCIO to access own data", () => {
      const result = canAccessSocioData("SOCIO", "user-123", "user-123");
      expect(result).toBe(true);
    });

    it("should deny SOCIO from accessing other socio data", () => {
      const result = canAccessSocioData("SOCIO", "user-123", "user-456");
      expect(result).toBe(false);
    });

    it("should allow INSTRUCTOR to access any socio data", () => {
      const result = canAccessSocioData("INSTRUCTOR", "instructor-1", "user-456");
      expect(result).toBe(true);
    });

    it("should allow RECEPCIONISTA to access any socio data", () => {
      const result = canAccessSocioData("RECEPCIONISTA", "recepcionista-1", "user-456");
      expect(result).toBe(true);
    });

    it("should allow ADMINISTRADOR to access any socio data", () => {
      const result = canAccessSocioData("ADMINISTRADOR", "admin-1", "user-456");
      expect(result).toBe(true);
    });

    it("should use exact string comparison for SOCIO self-check", () => {
      const result = canAccessSocioData("SOCIO", "user-123", "user-123");
      expect(result).toBe(true);

      // Even slight difference should deny
      const resultWithDifferentCase = canAccessSocioData("SOCIO", "User-123", "user-123");
      expect(resultWithDifferentCase).toBe(false);
    });
  });

  describe("canAccessAllRutinas", () => {
    it("should allow INSTRUCTOR to access all rutinas", () => {
      const result = canAccessAllRutinas("INSTRUCTOR");
      expect(result).toBe(true);
    });

    it("should allow RECEPCIONISTA to access all rutinas", () => {
      const result = canAccessAllRutinas("RECEPCIONISTA");
      expect(result).toBe(true);
    });

    it("should allow ADMINISTRADOR to access all rutinas", () => {
      const result = canAccessAllRutinas("ADMINISTRADOR");
      expect(result).toBe(true);
    });

    it("should deny SOCIO from accessing all rutinas (requires handler filtering)", () => {
      const result = canAccessAllRutinas("SOCIO");
      expect(result).toBe(false);
    });

    it("should return false for SOCIO to indicate handler filtering needed", () => {
      const result = canAccessAllRutinas("SOCIO");
      expect(result).toBe(false);
    });
  });

  describe("Authorization composition scenarios", () => {
    it("should allow ADMINISTRADOR override approval + data access", () => {
      const canApprove = canApproveAccessOverride("ADMINISTRADOR");
      const canAccess = canAccessSocioData("ADMINISTRADOR", "admin-1", "user-456");

      expect(canApprove).toBe(true);
      expect(canAccess).toBe(true);
    });

    it("should deny RECEPCIONISTA override approval but allow data access", () => {
      const canApprove = canApproveAccessOverride("RECEPCIONISTA");
      const canAccess = canAccessSocioData("RECEPCIONISTA", "recep-1", "user-456");

      expect(canApprove).toBe(false);
      expect(canAccess).toBe(true);
    });

    it("should require handler filtering for SOCIO rutina access", () => {
      const canAccessAll = canAccessAllRutinas("SOCIO");
      expect(canAccessAll).toBe(false);
      // This signals the handler must filter to assigned rutinas only
    });

    it("should allow INSTRUCTOR full rutina access without handler filtering", () => {
      const canAccessAll = canAccessAllRutinas("INSTRUCTOR");
      expect(canAccessAll).toBe(true);
      // Handler can return all rutinas without filtering
    });
  });
});
