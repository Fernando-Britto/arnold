import { canApproveAccessOverride } from "./fine-grained-auth";

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
});
