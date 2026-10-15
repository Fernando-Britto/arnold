import { canApproveAccessOverride, rolVigente } from "./fine-grained-auth";

jest.mock("@/lib/db", () => ({
  prisma: { usuario: { findUnique: jest.fn() } },
}));

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

  describe("rolVigente (T)", () => {
    async function mockUsuario(valor: unknown) {
      const { prisma } = await import("@/lib/db");
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(valor);
    }

    it("devuelve el rol cuando la cuenta está ACTIVA y no dada de baja", async () => {
      await mockUsuario({ rol: "ADMINISTRADOR", estado: "ACTIVO", deletedAt: null });
      await expect(rolVigente("u1")).resolves.toBe("ADMINISTRADOR");
    });

    it("devuelve null si la cuenta no está ACTIVA (aunque el JWT diga ADMINISTRADOR)", async () => {
      await mockUsuario({ rol: "ADMINISTRADOR", estado: "BLOQUEADO", deletedAt: null });
      await expect(rolVigente("u1")).resolves.toBeNull();
    });

    it("devuelve null si la cuenta está dada de baja", async () => {
      await mockUsuario({ rol: "ADMINISTRADOR", estado: "ACTIVO", deletedAt: new Date() });
      await expect(rolVigente("u1")).resolves.toBeNull();
    });

    it("devuelve null si el usuario no existe", async () => {
      await mockUsuario(null);
      await expect(rolVigente("u1")).resolves.toBeNull();
    });
  });
});
