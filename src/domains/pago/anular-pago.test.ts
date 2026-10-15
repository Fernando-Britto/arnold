/**
 * Anulación de un pago (P-39).
 * Prisma va mockeado, igual que el resto de las suites: `$transaction(callback)` recibe el
 * mismo mock como `tx`.
 */
import { anularPago, PAYMENT_ALREADY_ANNULLED } from "./anular-pago";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    pago: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    cuota: { delete: jest.fn() },
  };
  prisma.$transaction = jest.fn((ops) =>
    typeof ops === "function" ? Promise.resolve(ops(prisma)) : Promise.resolve(ops)
  );
  return { prisma };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mocks(): Promise<any> {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

const PAGO = {
  id: "pago-1",
  socioId: "socio-1",
  cuotaId: "cuota-1",
  estado: "CONFIRMADO",
};

describe("anularPago — validación", () => {
  beforeEach(() => jest.clearAllMocks());

  it("exige un pagoId", async () => {
    await expect(anularPago({ pagoId: "   ", motivo: "error de cobro" })).rejects.toThrow(
      /VALIDATION_ERROR/
    );
  });

  it("exige un motivo no vacío", async () => {
    await expect(anularPago({ pagoId: "pago-1", motivo: "  " })).rejects.toThrow(
      /VALIDATION_ERROR/
    );
  });
});

describe("anularPago — flujo", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 si el pago no existe", async () => {
    const prisma = await mocks();
    prisma.pago.findUnique.mockResolvedValue(null);

    await expect(anularPago({ pagoId: "pago-x", motivo: "error" })).rejects.toThrow(/NOT_FOUND/);
    expect(prisma.pago.update).not.toHaveBeenCalled();
  });

  it("conflicto propio si el pago ya está anulado, sin volver a escribirlo", async () => {
    const prisma = await mocks();
    prisma.pago.findUnique.mockResolvedValue({ ...PAGO, estado: "ANULADO" });

    await expect(anularPago({ pagoId: "pago-1", motivo: "error" })).rejects.toThrow(
      /PAYMENT_ALREADY_ANNULLED/
    );
    expect(prisma.pago.update).not.toHaveBeenCalled();
    expect(PAYMENT_ALREADY_ANNULLED).toMatch(/ya está anulado/i);
  });

  it("marca ANULADO, borra la cuota sin otro pago vigente y devuelve su id", async () => {
    const prisma = await mocks();
    prisma.pago.findUnique.mockResolvedValue(PAGO);
    prisma.pago.update.mockResolvedValue({ ...PAGO, estado: "ANULADO" });
    prisma.pago.count.mockResolvedValue(0);
    prisma.cuota.delete.mockResolvedValue({ id: "cuota-1" });

    const r = await anularPago({ pagoId: "pago-1", motivo: "cobro por error" });

    expect(prisma.pago.update).toHaveBeenCalledWith({
      where: { id: "pago-1" },
      data: { estado: "ANULADO" },
    });
    expect(prisma.pago.count).toHaveBeenCalledWith({
      where: { cuotaId: "cuota-1", id: { not: "pago-1" }, estado: { not: "ANULADO" } },
    });
    expect(prisma.cuota.delete).toHaveBeenCalledWith({ where: { id: "cuota-1" } });
    expect(r.cuotaEliminada).toBe("cuota-1");
    expect((r.pago as { estado: string }).estado).toBe("ANULADO");
  });

  it("conserva la cuota si tiene otro pago todavía vigente", async () => {
    const prisma = await mocks();
    prisma.pago.findUnique.mockResolvedValue(PAGO);
    prisma.pago.update.mockResolvedValue({ ...PAGO, estado: "ANULADO" });
    prisma.pago.count.mockResolvedValue(1);

    const r = await anularPago({ pagoId: "pago-1", motivo: "cobro por error" });

    expect(prisma.cuota.delete).not.toHaveBeenCalled();
    expect(r.cuotaEliminada).toBeNull();
  });

  it("no borra nada si el pago no cubría una cuota", async () => {
    const prisma = await mocks();
    prisma.pago.findUnique.mockResolvedValue({ ...PAGO, cuotaId: null });
    prisma.pago.update.mockResolvedValue({ ...PAGO, cuotaId: null, estado: "ANULADO" });

    const r = await anularPago({ pagoId: "pago-1", motivo: "error" });

    expect(prisma.pago.count).not.toHaveBeenCalled();
    expect(prisma.cuota.delete).not.toHaveBeenCalled();
    expect(r.cuotaEliminada).toBeNull();
  });
});
