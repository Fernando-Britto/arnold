import {
  validateAccessOverride,
  handleAccessOverride,
  requestAccessOverride,
} from "./access-override";
import * as fineGrainedAuth from "@/lib/fine-grained-auth";

jest.mock("@/lib/fine-grained-auth");
jest.mock("@/lib/db", () => {
  const store = { auditorias: [] as unknown[], asistencias: [] as unknown[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    socio: { findUnique: jest.fn() },
    auditoriaAcceso: { create: jest.fn() },
    asistencia: { create: jest.fn() },
  };
  // `$transaction(callback)` con rollback sobre un store en memoria.
  prisma.$transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    const snapshot = { auditorias: [...store.auditorias], asistencias: [...store.asistencias] };
    try {
      return await callback(prisma);
    } catch (error) {
      store.auditorias = snapshot.auditorias;
      store.asistencias = snapshot.asistencias;
      throw error;
    }
  });
  prisma.__store = store;
  return { prisma };
});

async function mocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { prisma } = (await import("@/lib/db")) as unknown as { prisma: any };
  return prisma;
}

function adminReq(motivo = "Próximo pago confirmado para 2026-08-15") {
  return {
    user: { id: "admin1", rol: "ADMINISTRADOR" },
    body: { motivo },
    ip: "192.168.1.1",
    headers: { "user-agent": "Mozilla/5.0" },
  } as unknown as Parameters<typeof handleAccessOverride>[0];
}

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
      (fineGrainedAuth.rolVigente as jest.Mock).mockResolvedValue("ADMINISTRADOR");
    });

    it("should throw FORBIDDEN for non-ADMIN user", async () => {
      (fineGrainedAuth.rolVigente as jest.Mock).mockResolvedValue("RECEPCIONISTA");
      (fineGrainedAuth.canApproveAccessOverride as jest.Mock).mockReturnValue(
        false
      );

      const mockReq = {
        user: { id: "user1", rol: "RECEPCIONISTA" },
        body: { motivo: "Payment confirmed" },
        ip: "192.168.1.1",
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Parameters<typeof handleAccessOverride>[0];

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
      } as unknown as Parameters<typeof handleAccessOverride>[0];

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

  describe("Atomicity (audit + asistencia in ONE transaction)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (fineGrainedAuth.rolVigente as jest.Mock).mockResolvedValue("ADMINISTRADOR");
      (fineGrainedAuth.canApproveAccessOverride as jest.Mock).mockReturnValue(true);
    });

    it("creates the audit row and the asistencia inside a single transaction", async () => {
      const prisma = await mocks();
      (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio1" });
      (prisma.auditoriaAcceso.create as jest.Mock).mockResolvedValue({ id: "aud-1" });
      (prisma.asistencia.create as jest.Mock).mockResolvedValue({ id: "asist-1" });

      const result = await handleAccessOverride(adminReq(), "socio1");

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.auditoriaAcceso.create).toHaveBeenCalledTimes(1);
      expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
    });

    it("does not persist the audit row if the asistencia fails (rollback)", async () => {
      const prisma = await mocks();
      const store = prisma.__store;
      (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio1" });
      (prisma.auditoriaAcceso.create as jest.Mock).mockImplementation(
        async ({ data }: { data: unknown }) => {
          store.auditorias.push(data);
          return { id: "aud-1" };
        }
      );
      (prisma.asistencia.create as jest.Mock).mockImplementation(async () => {
        throw new Error("boom-asistencia");
      });

      await expect(handleAccessOverride(adminReq(), "socio1")).rejects.toThrow("boom-asistencia");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(store.auditorias).toHaveLength(0);
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

  describe("BLOQUEADA override — sólo el ADMINISTRADOR (P-24)", () => {
    // El módulo está mockeado arriba: usamos la implementación REAL para blindar la regla.
    const realAuth = jest.requireActual<typeof fineGrainedAuth>("@/lib/fine-grained-auth");

    it("canApproveAccessOverride permite al ADMINISTRADOR y niega al recepcionista", () => {
      expect(realAuth.canApproveAccessOverride("ADMINISTRADOR")).toBe(true);
      expect(realAuth.canApproveAccessOverride("RECEPCIONISTA")).toBe(false);
    });

    it("un RECEPCIONISTA NO puede autorizar el ingreso de una cuenta BLOQUEADA", async () => {
      (fineGrainedAuth.canApproveAccessOverride as jest.Mock).mockImplementation(
        realAuth.canApproveAccessOverride
      );
      (fineGrainedAuth.rolVigente as jest.Mock).mockResolvedValue("RECEPCIONISTA");
      const prisma = await mocks();
      (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio1", estadoCuota: "BLOQUEADA" });

      const recepcionista = {
        user: { id: "recep1", rol: "RECEPCIONISTA" },
        body: { motivo: "Insistió en ingresar" },
        ip: "192.168.1.9",
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Parameters<typeof handleAccessOverride>[0];

      await expect(handleAccessOverride(recepcionista, "socio1")).rejects.toThrow(
        "Rol de administrador requerido"
      );
      expect(prisma.auditoriaAcceso.create).not.toHaveBeenCalled();
      expect(prisma.asistencia.create).not.toHaveBeenCalled();
    });

    it("un ADMINISTRADOR sí puede autorizar el ingreso de una cuenta BLOQUEADA", async () => {
      (fineGrainedAuth.canApproveAccessOverride as jest.Mock).mockImplementation(
        realAuth.canApproveAccessOverride
      );
      (fineGrainedAuth.rolVigente as jest.Mock).mockResolvedValue("ADMINISTRADOR");
      const prisma = await mocks();
      (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio1", estadoCuota: "BLOQUEADA" });
      (prisma.auditoriaAcceso.create as jest.Mock).mockResolvedValue({ id: "aud-1" });
      (prisma.asistencia.create as jest.Mock).mockResolvedValue({ id: "asist-1" });

      const result = await handleAccessOverride(adminReq(), "socio1");

      expect(result.success).toBe(true);
      expect(prisma.auditoriaAcceso.create).toHaveBeenCalledTimes(1);
      expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("T — el rol sale de la base, no del JWT", () => {
    const realAuth = jest.requireActual<typeof fineGrainedAuth>("@/lib/fine-grained-auth");

    beforeEach(() => {
      jest.clearAllMocks();
      (fineGrainedAuth.canApproveAccessOverride as jest.Mock).mockImplementation(
        realAuth.canApproveAccessOverride
      );
    });

    it("un JWT viejo de ADMINISTRADOR con rol real RECEPCIONISTA se NIEGA", async () => {
      (fineGrainedAuth.rolVigente as jest.Mock).mockResolvedValue("RECEPCIONISTA");
      const prisma = await mocks();
      (prisma.socio.findUnique as jest.Mock).mockResolvedValue({ id: "socio1" });

      const staleAdmin = {
        user: { id: "u1", rol: "ADMINISTRADOR" }, // rol firmado en el token (viejo)
        body: { motivo: "Próximo pago confirmado para 2026-08-15" },
        ip: "192.168.1.1",
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Parameters<typeof handleAccessOverride>[0];

      await expect(handleAccessOverride(staleAdmin, "socio1")).rejects.toThrow(
        "Rol de administrador requerido"
      );
      expect(prisma.auditoriaAcceso.create).not.toHaveBeenCalled();
      expect(prisma.asistencia.create).not.toHaveBeenCalled();
    });

    it("sin rol vigente (cuenta inactiva/baja) se NIEGA", async () => {
      (fineGrainedAuth.rolVigente as jest.Mock).mockResolvedValue(null);
      const prisma = await mocks();

      const staleAdmin = {
        user: { id: "u1", rol: "ADMINISTRADOR" },
        body: { motivo: "Próximo pago confirmado para 2026-08-15" },
        ip: "192.168.1.1",
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Parameters<typeof handleAccessOverride>[0];

      await expect(handleAccessOverride(staleAdmin, "socio1")).rejects.toThrow(
        "Rol de administrador requerido"
      );
      expect(prisma.auditoriaAcceso.create).not.toHaveBeenCalled();
    });
  });
});
