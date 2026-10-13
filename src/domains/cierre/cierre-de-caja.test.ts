/**
 * Cierre de caja (T-040, D-42).
 * Spec: openspec/specs/... El cierre agrupa los Pago del turno por método.
 *
 * Prisma va mockeado, igual que registrar-pago.test.ts: el motor remoto no es
 * alcanzable desde este entorno. `$transaction(callback)` recibe el mismo mock
 * como `tx` (los modelos son los mismos en el cliente interactivo).
 */
import {
  calcularTotales,
  cerrarCaja,
  resolverEmpleadoId,
  pagosPendientesDeCierre,
  previsualizarCierre,
  listarCierres,
} from "./cierre-de-caja";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    pago: { findMany: jest.fn(), updateMany: jest.fn() },
    cierreDeCaja: { create: jest.fn(), findMany: jest.fn() },
    empleado: { findUnique: jest.fn() },
  };
  prisma.$transaction = jest.fn((ops) =>
    Array.isArray(ops) ? Promise.resolve(ops.map(() => ({}))) : Promise.resolve(ops(prisma))
  );
  return { prisma };
});

const d = (iso: string) => new Date(iso);

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

describe("calcularTotales (puro)", () => {
  it("solo cuenta pagos CONFIRMADO y agrupa por método", () => {
    const totales = calcularTotales([
      { id: "p1", monto: 1000, metodoPago: "EFECTIVO", estado: "CONFIRMADO" },
      { id: "p2", monto: 500.5, metodoPago: "EFECTIVO", estado: "CONFIRMADO" },
      { id: "p3", monto: 250.25, metodoPago: "TRANSFERENCIA", estado: "CONFIRMADO" },
      { id: "p4", monto: 100.01, metodoPago: "TARJETA", estado: "CONFIRMADO" },
      { id: "p5", monto: 999, metodoPago: "EFECTIVO", estado: "ANULADO" },
      { id: "p6", monto: 888, metodoPago: "TARJETA", estado: "PENDIENTE" },
    ]);

    expect(totales).toEqual({
      totalRecaudado: 1850.76,
      totalEfectivo: 1500.5,
      totalTransferencia: 250.25,
      totalTarjeta: 100.01,
      cantidadOperaciones: 4,
    });
  });

  it("redondea al centavo y evita el ruido de punto flotante", () => {
    const totales = calcularTotales([
      { id: "p1", monto: 0.1, metodoPago: "TRANSFERENCIA", estado: "CONFIRMADO" },
      { id: "p2", monto: 0.2, metodoPago: "TRANSFERENCIA", estado: "CONFIRMADO" },
      { id: "p3", monto: 100.005, metodoPago: "TARJETA", estado: "CONFIRMADO" },
    ]);

    expect(totales.totalTransferencia).toBe(0.3);
    expect(totales.totalTarjeta).toBe(100.01);
    expect(totales.totalRecaudado).toBe(100.31);
  });

  it("sin pagos devuelve todo en cero", () => {
    expect(calcularTotales([])).toEqual({
      totalRecaudado: 0,
      totalEfectivo: 0,
      totalTransferencia: 0,
      totalTarjeta: 0,
      cantidadOperaciones: 0,
    });
  });
});

describe("cerrarCaja (servicio)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crea el cierre con los totales y marca EXACTAMENTE los pagos traídos", async () => {
    const prisma = await mocks();
    const pagos = [
      { id: "p1", monto: 1000, metodoPago: "EFECTIVO", estado: "CONFIRMADO", cierreDeCajaId: null },
      { id: "p2", monto: 200, metodoPago: "TARJETA", estado: "CONFIRMADO", cierreDeCajaId: null },
    ];
    (prisma.pago.findMany as jest.Mock).mockResolvedValue(pagos);
    (prisma.cierreDeCaja.create as jest.Mock).mockResolvedValue({ id: "cierre-1", responsableId: "emp-1" });

    const desde = d("2026-10-12T03:00:00.000Z");
    const hasta = d("2026-10-12T21:00:00.000Z");
    const r = await cerrarCaja({ responsableId: "emp-1", desde, hasta });

    expect(prisma.pago.findMany).toHaveBeenCalledWith({
      where: {
        estado: "CONFIRMADO",
        cierreDeCajaId: null,
        fechaPago: { gte: desde, lte: hasta },
      },
    });
    expect(prisma.cierreDeCaja.create).toHaveBeenCalledWith({
      data: {
        responsableId: "emp-1",
        totalRecaudado: 1200,
        totalEfectivo: 1000,
        totalTransferencia: 0,
        totalTarjeta: 200,
        cantidadOperaciones: 2,
      },
    });
    expect(prisma.pago.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] } },
      data: { cierreDeCajaId: "cierre-1" },
    });
    expect(r).toMatchObject({ id: "cierre-1", pagos });
  });

  it("sin pagos pendientes crea un cierre válido en cero y no toca pagos", async () => {
    const prisma = await mocks();
    (prisma.pago.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.cierreDeCaja.create as jest.Mock).mockResolvedValue({ id: "cierre-2", responsableId: "emp-1" });

    const r = await cerrarCaja({ responsableId: "emp-1", desde: d("2026-10-12T03:00:00.000Z"), hasta: d("2026-10-12T21:00:00.000Z") });

    expect(prisma.cierreDeCaja.create).toHaveBeenCalledWith({
      data: {
        responsableId: "emp-1",
        totalRecaudado: 0,
        totalEfectivo: 0,
        totalTransferencia: 0,
        totalTarjeta: 0,
        cantidadOperaciones: 0,
      },
    });
    expect(prisma.pago.updateMany).not.toHaveBeenCalled();
    expect(r).toMatchObject({ id: "cierre-2", pagos: [] });
  });

  it("no crea el cierre si la transacción falla (todo o nada)", async () => {
    const prisma = await mocks();
    (prisma.pago.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.cierreDeCaja.create as jest.Mock).mockRejectedValueOnce(new Error("DB down"));

    await expect(
      cerrarCaja({ responsableId: "emp-1", desde: d("2026-10-12T03:00:00.000Z"), hasta: d("2026-10-12T21:00:00.000Z") })
    ).rejects.toThrow("DB down");
  });
});

describe("resolverEmpleadoId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve el Empleado.id del Usuario logueado", async () => {
    const prisma = await mocks();
    (prisma.empleado.findUnique as jest.Mock).mockResolvedValue({ id: "emp-1" });

    await expect(resolverEmpleadoId("u-rec")).resolves.toBe("emp-1");
    expect(prisma.empleado.findUnique).toHaveBeenCalledWith({ where: { usuarioId: "u-rec" } });
  });

  it("lanza un error de validación claro si el Usuario no tiene Empleado", async () => {
    const prisma = await mocks();
    (prisma.empleado.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(resolverEmpleadoId("u-x")).rejects.toThrow(/VALIDATION_ERROR/);
  });
});

describe("pagosPendientesDeCierre / previsualizarCierre", () => {
  beforeEach(() => jest.clearAllMocks());

  it("trae los pagos confirmados sin cierre en el rango, ordenados por fecha", async () => {
    const prisma = await mocks();
    (prisma.pago.findMany as jest.Mock).mockResolvedValue([]);
    const desde = d("2026-10-12T03:00:00.000Z");
    const hasta = d("2026-10-12T21:00:00.000Z");

    await pagosPendientesDeCierre({ desde, hasta });

    expect(prisma.pago.findMany).toHaveBeenCalledWith({
      where: { estado: "CONFIRMADO", cierreDeCajaId: null, fechaPago: { gte: desde, lte: hasta } },
      orderBy: { fechaPago: "asc" },
    });
  });

  it("previsualiza con los mismos totales que el cierre", async () => {
    const prisma = await mocks();
    (prisma.pago.findMany as jest.Mock).mockResolvedValue([
      { id: "p1", monto: 300, metodoPago: "EFECTIVO", estado: "CONFIRMADO" },
    ]);

    const r = await previsualizarCierre({ desde: d("2026-10-12T03:00:00.000Z"), hasta: d("2026-10-12T21:00:00.000Z") });

    expect(r).toMatchObject({ totalRecaudado: 300, totalEfectivo: 300, cantidadOperaciones: 1 });
  });
});

describe("listarCierres", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lista los cierres más recientes primero con sus pagos", async () => {
    const prisma = await mocks();
    (prisma.cierreDeCaja.findMany as jest.Mock).mockResolvedValue([{ id: "cierre-1" }]);

    const r = await listarCierres();

    expect(r).toEqual([{ id: "cierre-1" }]);
    expect(prisma.cierreDeCaja.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { pagos: true },
    });
  });
});
