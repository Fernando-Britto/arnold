/**
 * Registro de un pago mensual (T-032, D-40, D-46).
 * Spec: openspec/specs/pagos-cuotas/spec.md
 *
 * Prisma va mockeado, igual que el resto de las suites: el motor de Prisma remoto
 * no es alcanzable desde este entorno. `$transaction(callback)` recibe el mismo mock
 * como `tx` (los modelos son los mismos en el cliente interactivo).
 * D-46: el flujo de pagos NUNCA escribe `Socio.estadoCuota`.
 */
import {
  registrarPago,
  listarPagosDeSocio,
  type RegistrarPagoInput,
} from "./registrar-pago";
import { finDePeriodo, inicioDePeriodo } from "./cuota";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    socio: { findUnique: jest.fn(), update: jest.fn() },
    cuota: { findFirst: jest.fn(), create: jest.fn() },
    pago: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    asistencia: { findFirst: jest.fn() },
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
    estadoCuota: "AL_DIA",
    fechaAlta: d("2025-01-01T10:00:00"),
  });
  // `cuota.findFirst` se usa dos veces: (1) la última cuota para calcular el plan
  // (sin filtro por `fechaVencimiento`) y (2) el guard anti doble-cobro dentro de la
  // transacción (con `fechaVencimiento`). Por defecto el guard no encuentra nada.
  (prisma.cuota.findFirst as jest.Mock).mockImplementation(
    (args: { where?: { fechaVencimiento?: unknown } } | undefined) =>
      args?.where?.fechaVencimiento ? Promise.resolve(null) : Promise.resolve(ultimaCuota)
  );
  (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG);
  (prisma.cuota.create as jest.Mock).mockResolvedValue({ id: "cuota-1", socioId: "socio-1" });
  (prisma.pago.create as jest.Mock).mockResolvedValue({ id: "pago-1", socioId: "socio-1", cuotaId: "cuota-1" });
  // Sin filas: por defecto el socio nunca asistió ni usó una oferta.
  (prisma.asistencia.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.pago.findFirst as jest.Mock).mockResolvedValue(null);
  return prisma;
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

describe("registrarPago — monto (D-40: el pago cubre una cuota completa)", () => {
  it("ignora un monto enviado por el cliente y persiste el monto del plan (PG-2)", async () => {
    await armarSocio(null);

    // El cliente intenta forzar un monto parcial: debe ignorarse y usarse plan.monto.
    const inputConMonto = {
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      monto: 5000,
      hoy: d("2026-11-16T18:00:00"),
    };
    const r = await registrarPago(inputConMonto as RegistrarPagoInput);

    expect(r.plan.monto).toBe(15000);
    const prisma = await mocks();
    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ monto: 15000 }),
    });
  });

  it("ignora monto 0 y persiste el monto del plan (no crea una cuota gratis)", async () => {
    await armarSocio(null);

    const inputConMonto = {
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      monto: 0,
      hoy: d("2026-11-16T18:00:00"),
    };
    const r = await registrarPago(inputConMonto as RegistrarPagoInput);

    expect(r.plan.monto).toBe(15000);
    const prisma = await mocks();
    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ monto: 15000 }),
    });
  });
});

describe("registrarPago — validación de entrada (PG-3)", () => {
  it("lanza VALIDATION_ERROR si falta socioId", async () => {
    const prisma = await mocks();

    const inputSinSocio = {
      metodoPago: "EFECTIVO",
      hoy: d("2026-11-01T10:00:00"),
    } as unknown as RegistrarPagoInput;

    await expect(registrarPago(inputSinSocio)).rejects.toThrow(/VALIDATION_ERROR.*socio/i);
    expect(prisma.socio.findUnique).not.toHaveBeenCalled();
  });

  it("lanza VALIDATION_ERROR si socioId es una cadena vacía", async () => {
    const prisma = await mocks();

    await expect(
      registrarPago({ socioId: "   ", metodoPago: "EFECTIVO", hoy: d("2026-11-01T10:00:00") })
    ).rejects.toThrow(/VALIDATION_ERROR.*socio/i);
    expect(prisma.socio.findUnique).not.toHaveBeenCalled();
  });

  it("lanza VALIDATION_ERROR si el input no es un objeto", async () => {
    const prisma = await mocks();

    await expect(registrarPago(null as unknown as RegistrarPagoInput)).rejects.toThrow(
      /VALIDATION_ERROR.*socio/i
    );
    expect(prisma.socio.findUnique).not.toHaveBeenCalled();
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

describe("registrarPago — anti doble-cobro (PG-4)", () => {
  it("lanza PAYMENT_ALREADY_REGISTERED si ya existe una cuota para el mismo período", async () => {
    await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });
    const prisma = await mocks();
    // El período objetivo es 2026-11: ya existe una cuota con ese vencimiento.
    // Segundo submit concurrente del mismo POST: el guard debe abortar.
    (prisma.cuota.findFirst as jest.Mock).mockImplementation(
      (args: { where?: { fechaVencimiento?: unknown } } | undefined) =>
        args?.where?.fechaVencimiento
          ? Promise.resolve({ id: "cuota-existente" })
          : Promise.resolve({ fechaVencimiento: finDePeriodo("2026-10") })
    );

    await expect(
      registrarPago({ socioId: "socio-1", metodoPago: "EFECTIVO", hoy: d("2026-11-05T10:00:00") })
    ).rejects.toThrow(/PAYMENT_ALREADY_REGISTERED/);

    expect(prisma.cuota.create).not.toHaveBeenCalled();
    expect(prisma.pago.create).not.toHaveBeenCalled();
  });

  it("corre el guard y la creación en UNA transacción Serializable (PG-4)", async () => {
    await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });

    const r = await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      hoy: d("2026-11-05T10:00:00"),
    });

    const prisma = await mocks();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    // El happy path sigue devolviendo el pago, la cuota, el plan y el estado.
    expect(r).toEqual({
      pago: { id: "pago-1", socioId: "socio-1", cuotaId: "cuota-1" },
      cuota: { id: "cuota-1", socioId: "socio-1" },
      plan: expect.objectContaining({ tipo: "RENOVACION", monto: 30000 }),
      estadoCuota: "AL_DIA",
      montoLista: null,
      descuentoPct: null,
    });
  });
});

describe("registrarPago — oferta de reactivación (D-54)", () => {
  const DIA_MS = 24 * 60 * 60 * 1000;
  const HOY_VENCIDO = d("2026-11-15T10:00:00");
  const hace = (fecha: Date, dias: number) => new Date(fecha.getTime() - dias * DIA_MS);
  const CONFIG_OFERTA_ACTIVA = {
    ...CONFIG,
    ofertaReactivacionActiva: true,
    diasSinAsistirParaOferta: 30,
    descuentoReactivacion: 10,
    enfriamientoOfertaDias: 180,
  };

  /** Socio con cuota VENCIDA y sin actividad reciente: elegible con la oferta activa. */
  async function armarElegible() {
    const prisma = await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });
    (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG_OFERTA_ACTIVA);
    (prisma.asistencia.findFirst as jest.Mock).mockResolvedValue({ fechaHora: hace(HOY_VENCIDO, 40) });
    (prisma.pago.findFirst as jest.Mock).mockResolvedValue(null);
    return prisma;
  }

  it("con la oferta activa y socio elegible el Pago lleva el monto descontado, montoLista y descuentoPct", async () => {
    const prisma = await armarElegible();
    (prisma.pago.create as jest.Mock).mockResolvedValue({
      id: "pago-1",
      socioId: "socio-1",
      cuotaId: "cuota-1",
      montoLista: 30000,
      descuentoPct: 10,
    });

    const r = await registrarPago({ socioId: "socio-1", metodoPago: "EFECTIVO", hoy: HOY_VENCIDO });

    expect(r.plan.monto).toBe(30000);
    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ monto: 27000, montoLista: 30000, descuentoPct: 10 }),
    });
    expect(r.montoLista).toBe(30000);
    expect(r.descuentoPct).toBe(10);
  });

  it("con la oferta apagada el Pago lleva el monto del plan y nulls (comportamiento actual)", async () => {
    const prisma = await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });

    await registrarPago({ socioId: "socio-1", metodoPago: "EFECTIVO", hoy: HOY_VENCIDO });

    expect(prisma.pago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ monto: 30000, montoLista: null, descuentoPct: null }),
    });
  });

  it("montoEsperado igual al monto calculado cobra normalmente", async () => {
    const prisma = await armarElegible();

    await registrarPago({
      socioId: "socio-1",
      metodoPago: "EFECTIVO",
      hoy: HOY_VENCIDO,
      montoEsperado: 27000,
    });

    expect(prisma.cuota.create).toHaveBeenCalledTimes(1);
    expect(prisma.pago.create).toHaveBeenCalledTimes(1);
  });

  it("montoEsperado distinto lanza AMOUNT_CHANGED y no crea ni cuota ni pago", async () => {
    const prisma = await armarElegible();

    await expect(
      registrarPago({
        socioId: "socio-1",
        metodoPago: "EFECTIVO",
        hoy: HOY_VENCIDO,
        montoEsperado: 21000,
      })
    ).rejects.toThrow(/AMOUNT_CHANGED/);

    expect(prisma.cuota.create).not.toHaveBeenCalled();
    expect(prisma.pago.create).not.toHaveBeenCalled();
  });

  it("evalúa la oferta dentro de la transacción (usa el tx, no el cliente externo)", async () => {
    const prisma = await armarSocio({ fechaVencimiento: finDePeriodo("2026-10") });
    // Con la oferta apagada no se consulta nada (corta antes); acá se activa para probar el tx.
    (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG_OFERTA_ACTIVA);
    const tx = {
      cuota: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "cuota-1" }),
      },
      pago: {
        create: jest.fn().mockResolvedValue({ id: "pago-1" }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      asistencia: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    (prisma.$transaction as jest.Mock).mockImplementationOnce((ops: (t: unknown) => unknown) =>
      Promise.resolve(ops(tx))
    );

    await registrarPago({ socioId: "socio-1", metodoPago: "EFECTIVO", hoy: HOY_VENCIDO });

    expect(tx.asistencia.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.pago.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.asistencia.findFirst).not.toHaveBeenCalled();
    expect(prisma.pago.findFirst).not.toHaveBeenCalled();
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
