/**
 * Registro de un pago mensual (T-032, D-40, D-46).
 * Spec: openspec/specs/pagos-cuotas/spec.md
 *
 * Prisma va mockeado, igual que el resto de las suites: el motor de Prisma remoto
 * no es alcanzable desde este entorno. `$transaction(callback)` recibe el mismo mock
 * como `tx` (los modelos son los mismos en el cliente interactivo).
 * D-46: el flujo de pagos NUNCA escribe `Socio.estadoCuota`.
 */
import { registrarPago, listarPagosDeSocio } from "./registrar-pago";
import { finDePeriodo, inicioDePeriodo } from "./cuota";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    socio: { findUnique: jest.fn(), update: jest.fn() },
    cuota: { findFirst: jest.fn(), create: jest.fn() },
    pago: { create: jest.fn(), findMany: jest.fn() },
    configuracionDelSistema: { findFirst: jest.fn() },
  };
  prisma.$transaction = jest.fn((ops) =>
    Array.isArray(ops) ? Promise.resolve(ops.map(() => ({}))) : Promise.resolve(ops(prisma))
  );
  return { prisma };
});

const d = (iso: string) => new Date(`${iso}-03:00`);

const CONFIG = { diaLimitePago: 10, diaCorteAltaTardia: 20, periodoGracia: 0 };

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

/** Socio con plan Gold de $30.000 y, opcionalmente, una última cuota. */
async function armarSocio(ultimaCuota: { fechaVencimiento: Date } | null = null) {
  const prisma = await mocks();
  (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
    id: "socio-1",
    membresiaAsignadaId: "plan-gold",
    membresiaAsignada: { id: "plan-gold", precio: 30000 },
  });
  (prisma.cuota.findFirst as jest.Mock).mockResolvedValue(ultimaCuota);
  (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG);
  (prisma.cuota.create as jest.Mock).mockResolvedValue({ id: "cuota-1", socioId: "socio-1" });
  (prisma.pago.create as jest.Mock).mockResolvedValue({ id: "pago-1", socioId: "socio-1", cuotaId: "cuota-1" });
}

describe("registrarPago — renovación", () => {
  it("cobra el mes siguiente al último cubierto, completo y sin recargo", async () => {
    await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      hoy: d("2026-11-05T10:00:00"),
    });

    expect(r.plan.tipo).toBe("RENOVACION");
    expect(r.plan.monto).toBe(30000);
    expect(r.estadoCuota).toBe("AL_DIA");

    const prisma = await mocks();
    expect(prisma.cuota.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socioId: "socio-1",
        membresiaId: "plan-gold",
        fechaInicio: inicioDePeriodo("2026-11"),
        fechaVencimiento: finDePeriodo("2026-11"),
      }),
    });
    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        monto: 30000,
        metodoPago: "EFECTIVO",
        socioId: "socio-1",
        cuotaId: "cuota-1",
        estado: "CONFIRMADO",
      }),
    });
  });

  it("un pago por adelantado encadena el período siguiente", async () => {
    await armarSocio({ fechaVencimiento: finDePeriodo("2026-11") });

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "TRANSFERENCIA",
      hoy: d("2026-11-25T10:00:00"),
    });

    expect(r.plan.tipo).toBe("RENOVACION");
    expect(r.plan.periodos).toEqual(["2026-12"]);
    expect(r.estadoCuota).toBe("AL_DIA");
  });
});

describe("registrarPago — alta", () => {
  it("alta antes del corte: prorratea los días que quedan del mes", async () => {
    await armarSocio(null);

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      hoy: d("2026-11-16T18:00:00"),
    });

    expect(r.plan.tipo).toBe("ALTA_PRORRATEO");
    expect(r.plan.monto).toBe(15000);
    expect(r.estadoCuota).toBe("AL_DIA");

    const prisma = await mocks();
    expect(prisma.cuota.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fechaInicio: d("2026-11-16T00:00:00"),
        fechaVencimiento: finDePeriodo("2026-11"),
      }),
    });
    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ monto: 15000 }),
    });
  });

  it("alta después del corte: cuota completa que cubre dos períodos", async () => {
    await armarSocio(null);

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "TARJETA",
      hoy: d("2026-10-30T11:00:00"),
    });

    expect(r.plan.tipo).toBe("ALTA_COMPLETA");
    expect(r.plan.monto).toBe(30000);
    expect(r.plan.cubreHasta.toISOString()).toBe(finDePeriodo("2026-11").toISOString());
    expect(r.estadoCuota).toBe("AL_DIA");

    const prisma = await mocks();
    expect(prisma.cuota.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fechaInicio: d("2026-10-30T00:00:00"),
        fechaVencimiento: finDePeriodo("2026-11"),
      }),
    });
  });

  it("socio sin cuota (estado previo SIN_CUOTA) se trata como alta", async () => {
    await armarSocio(null);

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      hoy: d("2026-11-25T10:00:00"),
    });

    // Sin cobertura previa no hay deuda retroactiva: aplica la regla de alta
    expect(r.plan.tipo).toBe("ALTA_COMPLETA");
    expect(r.plan.periodos).toEqual(["2026-11", "2026-12"]);
    expect(r.estadoCuota).toBe("AL_DIA");
  });
});

describe("registrarPago — monto", () => {
  it("usa el monto provisto cuando es finito y >= 0", async () => {
    await armarSocio(null);

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      monto: 5000,
      hoy: d("2026-11-16T18:00:00"),
    });

    expect(r.plan.monto).toBe(15000);
    const prisma = await mocks();
    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ monto: 5000 }),
    });
  });

  it("cae al monto del plan si el monto provisto es inválido", async () => {
    await armarSocio(null);

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      monto: -1,
      hoy: d("2026-11-16T18:00:00"),
    });

    expect(r.plan.monto).toBe(15000);
    const prisma = await mocks();
    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ monto: 15000 }),
    });
  });
});

describe("registrarPago — errores y reglas duras", () => {
  it("lanza NOT_FOUND si el socio no existe", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      registrarPago({ socioId: "nope", metodoPago: "EFECTIVO", hoy: d("2026-11-01T10:00:00") })
    ).rejects.toThrow("NOT_FOUND");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lanza error de validación si el socio no tiene membresía asignada", async () => {
    const prisma = await mocks();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
      id: "socio-1",
      membresiaAsignadaId: null,
      membresiaAsignada: null,
    });

    await expect(
      registrarPago({ socioId: "socio-1", metodoPago: "EFECTIVO", hoy: d("2026-11-01T10:00:00") })
    ).rejects.toThrow(/VALIDATION_ERROR.*membresía/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lanza error de validación si el método de pago es inválido", async () => {
    const prisma = await mocks();

    await expect(
      registrarPago({ socioId: "socio-1", metodoPago: "BITCOIN", hoy: d("2026-11-01T10:00:00") })
    ).rejects.toThrow(/VALIDATION_ERROR.*[Mm]étodo/);
    expect(prisma.socio.findUnique).not.toHaveBeenCalled();
  });

  it("crea Cuota y Pago en UNA sola transacción", async () => {
    await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });

    await registrarPago({ socioId: "socio-1", metodoPago: "EFECTIVO", hoy: d("2026-11-05T10:00:00") });

    const prisma = await mocks();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.cuota.create).toHaveBeenCalledTimes(1);
    expect(prisma.pago.create).toHaveBeenCalledTimes(1);
  });

  it("NUNCA escribe Socio.estadoCuota (D-46)", async () => {
    await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });

    await registrarPago({ socioId: "socio-1", metodoPago: "EFECTIVO", hoy: d("2026-11-05T10:00:00") });

    const prisma = await mocks();
    expect(prisma.socio.update).not.toHaveBeenCalled();
  });

  it("usa la configuración por defecto (10/20/0) si no existe la fila", async () => {
    await armarSocio(null);
    const prisma = await mocks();
    (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(null);

    // día 21: pasó el corte por defecto (20) → cuota completa
    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      hoy: d("2026-11-21T10:00:00"),
    });

    expect(r.plan.tipo).toBe("ALTA_COMPLETA");
  });
});

describe("listarPagosDeSocio", () => {
  it("lista los pagos del socio con su cuota, del más reciente al más viejo", async () => {
    const prisma = await mocks();
    const pagos = [{ id: "pago-1", monto: 30000 }];
    (prisma.pago.findMany as jest.Mock).mockResolvedValueOnce(pagos);

    const r = await listarPagosDeSocio("socio-1");

    expect(r).toEqual(pagos);
    expect(prisma.pago.findMany).toHaveBeenCalledWith({
      where: { socioId: "socio-1" },
      include: { cuota: true },
      orderBy: { fechaPago: "desc" },
    });
  });
});
