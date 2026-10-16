/** @jest-environment node */
/**
 * Servicio de acceso biométrico por huella (T-041, D-43/D-47). Prisma va mockeado: el motor
 * remoto no es alcanzable. Cubre enrolamiento, baja, confirmación y acceso por huella.
 */
jest.mock("@/lib/db", () => {
  const prisma = {
    socio: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    solicitudDeHuella: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    cuota: { findFirst: jest.fn() },
    configuracionDelSistema: { findFirst: jest.fn() },
    asistencia: { findFirst: jest.fn(), create: jest.fn() },
    auditoriaAcceso: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  return { prisma };
});

import {
  solicitarEnrolamiento,
  solicitarBaja,
  estadoHuella,
  tomarSolicitudPendiente,
  confirmarSolicitud,
  handleAccesoPorHuella,
} from "./huellas";
import { finDePeriodo } from "@/domains/pago/cuota";

type MockFn = jest.Mock;
interface MockPrisma {
  socio: { findUnique: MockFn; findMany: MockFn; update: MockFn };
  solicitudDeHuella: {
    findFirst: MockFn;
    findMany: MockFn;
    create: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  cuota: { findFirst: MockFn };
  configuracionDelSistema: { findFirst: MockFn };
  asistencia: { findFirst: MockFn; create: MockFn };
  auditoriaAcceso: { create: MockFn };
  $transaction: MockFn;
}

const d = (iso: string) => new Date(`${iso}-03:00`);
const CONFIG = { diaLimitePago: 10, periodoGracia: 0 };
const AHORA = d("2026-11-05T10:00:00");

async function mocks(): Promise<MockPrisma> {
  const { prisma } = await import("@/lib/db");
  return prisma as unknown as MockPrisma;
}

/** Solicitud completa tal como la devolvería Prisma. */
function solicitud(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    socioId: "socio-1",
    accion: "ENROLAR",
    huellaId: 3,
    estado: "PENDIENTE",
    motivo: null,
    duplicadoDe: null,
    createdAt: d("2026-11-05T09:00:00"),
    resueltaEn: null,
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  const prisma = await mocks();
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma));
  // Defaults sanos para el camino de acceso (se sobreescriben por test).
  prisma.configuracionDelSistema.findFirst.mockResolvedValue(CONFIG);
  prisma.cuota.findFirst.mockResolvedValue({ fechaVencimiento: finDePeriodo("2026-11") });
  prisma.asistencia.findFirst.mockResolvedValue(null);
  prisma.asistencia.create.mockResolvedValue({ id: "asist-1" });
  prisma.auditoriaAcceso.create.mockResolvedValue({ id: "aud-1" });
});

describe("solicitarEnrolamiento", () => {
  it("exige consentimiento y no toca la base sin él", async () => {
    const prisma = await mocks();
    await expect(solicitarEnrolamiento("socio-1", { consentimiento: false })).rejects.toThrow(
      /VALIDATION_ERROR/
    );
    expect(prisma.socio.findUnique).not.toHaveBeenCalled();
    expect(prisma.solicitudDeHuella.create).not.toHaveBeenCalled();
  });

  it("lanza NOT_FOUND si el socio no existe", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(null);
    await expect(solicitarEnrolamiento("nope", { consentimiento: true })).rejects.toThrow("NOT_FOUND");
    expect(prisma.solicitudDeHuella.create).not.toHaveBeenCalled();
  });

  it("elige un ID libre reservando huellas asignadas y solicitudes PENDIENTES", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue({ id: "socio-1", huellaId: null });
    prisma.socio.findMany.mockResolvedValue([{ huellaId: 1 }, { huellaId: null }]);
    prisma.solicitudDeHuella.findMany.mockResolvedValue([{ huellaId: 2 }]);
    prisma.solicitudDeHuella.create.mockImplementation(async ({ data }: { data: unknown }) => ({
      ...solicitud(),
      ...(data as object),
    }));

    const r = await solicitarEnrolamiento("socio-1", { consentimiento: true });

    expect(prisma.solicitudDeHuella.create).toHaveBeenCalledWith({
      data: { socioId: "socio-1", accion: "ENROLAR", huellaId: 3, estado: "PENDIENTE" },
    });
    expect(prisma.socio.update).toHaveBeenCalledWith({
      where: { id: "socio-1" },
      data: { huellaConsentimientoEn: expect.any(Date) },
    });
    expect(r.huellaId).toBe(3);
    expect(r.accion).toBe("ENROLAR");
    expect("socioId" in r).toBe(false);
  });

  it("marca FALLIDA cualquier PENDIENTE previa del socio (reemplazo)", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue({ id: "socio-1", huellaId: null });
    prisma.socio.findMany.mockResolvedValue([]);
    prisma.solicitudDeHuella.findMany.mockResolvedValue([]);
    prisma.solicitudDeHuella.create.mockResolvedValue(solicitud());

    await solicitarEnrolamiento("socio-1", { consentimiento: true });

    expect(prisma.solicitudDeHuella.updateMany).toHaveBeenCalledWith({
      where: { socioId: "socio-1", estado: "PENDIENTE" },
      data: { estado: "FALLIDA", motivo: "reemplazada", resueltaEn: expect.any(Date) },
    });
  });

  it("lanza VALIDATION_ERROR si el sensor está lleno", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue({ id: "socio-1", huellaId: null });
    prisma.socio.findMany.mockResolvedValue(
      Array.from({ length: 1000 }, (_v, i) => ({ huellaId: i + 1 }))
    );
    prisma.solicitudDeHuella.findMany.mockResolvedValue([]);

    await expect(solicitarEnrolamiento("socio-1", { consentimiento: true })).rejects.toThrow(
      /No hay IDs de huella libres/
    );
    expect(prisma.solicitudDeHuella.create).not.toHaveBeenCalled();
  });
});

describe("solicitarBaja", () => {
  it("crea una solicitud BORRAR con el huellaId actual", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue({ id: "socio-1", huellaId: 7 });
    prisma.solicitudDeHuella.create.mockImplementation(async ({ data }: { data: unknown }) => ({
      ...solicitud({ accion: "BORRAR", huellaId: 7 }),
      ...(data as object),
    }));

    const r = await solicitarBaja("socio-1");

    expect(prisma.solicitudDeHuella.create).toHaveBeenCalledWith({
      data: { socioId: "socio-1", accion: "BORRAR", huellaId: 7, estado: "PENDIENTE" },
    });
    expect(r.accion).toBe("BORRAR");
  });

  it("lanza VALIDATION_ERROR si el socio no tiene huella", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue({ id: "socio-1", huellaId: null });
    await expect(solicitarBaja("socio-1")).rejects.toThrow(/VALIDATION_ERROR/);
    expect(prisma.solicitudDeHuella.create).not.toHaveBeenCalled();
  });

  it("lanza NOT_FOUND si el socio no existe", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(null);
    await expect(solicitarBaja("nope")).rejects.toThrow("NOT_FOUND");
  });
});

describe("estadoHuella", () => {
  it("devuelve la huella, el consentimiento y la solicitud más reciente", async () => {
    const prisma = await mocks();
    const consentimiento = d("2026-10-01T09:00:00");
    prisma.socio.findUnique.mockResolvedValue({
      id: "socio-1",
      huellaId: 5,
      huellaConsentimientoEn: consentimiento,
    });
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(solicitud({ huellaId: 5, estado: "CONFIRMADA" }));

    const r = await estadoHuella("socio-1");

    expect(r.huellaId).toBe(5);
    expect(r.consentimientoEn).toBe(consentimiento);
    expect(r.solicitud?.estado).toBe("CONFIRMADA");
    expect(prisma.solicitudDeHuella.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("devuelve solicitud null y huella null cuando no hay nada", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue({ id: "socio-1", huellaId: null, huellaConsentimientoEn: null });
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(null);

    const r = await estadoHuella("socio-1");
    expect(r).toEqual({ huellaId: null, consentimientoEn: null, solicitud: null });
  });

  it("lanza NOT_FOUND si el socio no existe", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(null);
    await expect(estadoHuella("nope")).rejects.toThrow("NOT_FOUND");
  });
});

describe("tomarSolicitudPendiente", () => {
  it("devuelve accion null sin pendientes", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(null);
    expect(await tomarSolicitudPendiente()).toEqual({ accion: null });
  });

  it("traduce ENROLAR a enrolar con el huellaId", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(solicitud({ accion: "ENROLAR", huellaId: 9 }));
    expect(await tomarSolicitudPendiente()).toEqual({ accion: "enrolar", huellaId: 9 });
    expect(prisma.solicitudDeHuella.findFirst).toHaveBeenCalledWith({
      where: { estado: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("traduce BORRAR a borrar con el huellaId", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(solicitud({ accion: "BORRAR", huellaId: 9 }));
    expect(await tomarSolicitudPendiente()).toEqual({ accion: "borrar", huellaId: 9 });
  });
});

describe("confirmarSolicitud", () => {
  it("ok enrolar: CONFIRMADA y setea Socio.huellaId", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(solicitud({ huellaId: 4, accion: "ENROLAR" }));

    const r = await confirmarSolicitud({ huellaId: 4, accion: "enrolar", ok: true });

    expect(prisma.solicitudDeHuella.update).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: { estado: "CONFIRMADA", motivo: null, resueltaEn: expect.any(Date) },
    });
    expect(prisma.socio.update).toHaveBeenCalledWith({
      where: { id: "socio-1" },
      data: { huellaId: 4 },
    });
    expect(r).toEqual({ ok: true });
  });

  it("ok borrar: limpia Socio.huellaId", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(
      solicitud({ huellaId: 4, accion: "BORRAR" })
    );

    const r = await confirmarSolicitud({ huellaId: 4, accion: "borrar", ok: true });

    expect(prisma.socio.update).toHaveBeenCalledWith({
      where: { id: "socio-1" },
      data: { huellaId: null },
    });
    expect(r).toEqual({ ok: true });
  });

  it("falla: FALLIDA con motivo y NO toca al socio", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(solicitud({ huellaId: 4 }));

    const r = await confirmarSolicitud({ huellaId: 4, accion: "enrolar", ok: false, motivo: "timeout" });

    expect(prisma.solicitudDeHuella.update).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: { estado: "FALLIDA", motivo: "timeout", resueltaEn: expect.any(Date) },
    });
    expect(prisma.socio.update).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, motivo: "timeout" });
  });

  it("guarda duplicadoDe cuando viene", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(solicitud({ huellaId: 4 }));

    await confirmarSolicitud({ huellaId: 4, accion: "enrolar", ok: false, motivo: "duplicado", duplicadoDe: 12 });

    expect(prisma.solicitudDeHuella.update).toHaveBeenCalledWith({
      where: { id: "sol-1" },
      data: { estado: "FALLIDA", motivo: "duplicado", resueltaEn: expect.any(Date), duplicadoDe: 12 },
    });
  });

  it("sin solicitud PENDIENTE que corresponda: no rompe", async () => {
    const prisma = await mocks();
    prisma.solicitudDeHuella.findFirst.mockResolvedValue(null);

    const r = await confirmarSolicitud({ huellaId: 999, accion: "enrolar", ok: true });

    expect(r).toEqual({ ok: false, motivo: "sin_solicitud_pendiente" });
    expect(prisma.solicitudDeHuella.update).not.toHaveBeenCalled();
    expect(prisma.socio.update).not.toHaveBeenCalled();
  });
});

describe("handleAccesoPorHuella", () => {
  const socioAcceso = {
    id: "socio-1",
    estadoCuota: "AL_DIA",
    huellaId: 4,
    usuario: { nombre: "Ana García" },
    membresiaAsignada: { nombre: "Gold" },
  };

  it("socio desconocido: audita DENY y no evalúa cuota", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(null);

    const r = await handleAccesoPorHuella({
      huellaId: 42,
      confianza: 90,
      ip: "10.0.0.1",
      userAgent: "sensor",
      ahora: AHORA,
    });

    expect(r).toEqual({ autorizado: false, motivo: "Huella no reconocida" });
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socioId: null,
        accion: "CHECK_IN",
        resultado: "DENY",
        motivo: "Huella no reconocida",
        ipAddress: "10.0.0.1",
      }),
    });
    expect(prisma.cuota.findFirst).not.toHaveBeenCalled();
    expect(prisma.asistencia.create).not.toHaveBeenCalled();
  });

  it("confianza insuficiente: audita DENY sin evaluar cuota", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(socioAcceso);

    const r = await handleAccesoPorHuella({
      huellaId: 4,
      confianza: 49,
      ip: "10.0.0.1",
      userAgent: "sensor",
      ahora: AHORA,
    });

    expect(r).toEqual({ autorizado: false, motivo: "Confianza insuficiente" });
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ socioId: "socio-1", resultado: "DENY", motivo: "Confianza insuficiente" }),
    });
    expect(prisma.cuota.findFirst).not.toHaveBeenCalled();
  });

  it("cuota al día: autorizado y registra Asistencia HUELLA en una transacción", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(socioAcceso);

    const r = await handleAccesoPorHuella({
      huellaId: 4,
      confianza: 80,
      ip: "10.0.0.1",
      userAgent: "sensor",
      ahora: AHORA,
    });

    expect(r).toEqual({ autorizado: true, nombre: "Ana García" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ socioId: "socio-1", estado: "PERMITIDO", metodo: "HUELLA" }),
    });
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: "CHECK_IN", resultado: "ALLOW" }),
    });
  });

  it("cuota vencida: denegado con motivo y Asistencia DENEGADO", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(socioAcceso);
    prisma.cuota.findFirst.mockResolvedValue({ fechaVencimiento: finDePeriodo("2026-09") });

    const r = await handleAccesoPorHuella({
      huellaId: 4,
      confianza: 80,
      ip: "10.0.0.1",
      userAgent: "sensor",
      ahora: AHORA,
    });

    expect(r.autorizado).toBe(false);
    expect(r.motivo).toMatch(/vencida/i);
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: "DENEGADO", metodo: "HUELLA" }),
    });
  });

  it("anti-passback: un ingreso previo en la ventana niega", async () => {
    const prisma = await mocks();
    prisma.socio.findUnique.mockResolvedValue(socioAcceso);
    prisma.asistencia.findFirst.mockResolvedValue({ id: "asist-prev" });

    const r = await handleAccesoPorHuella({
      huellaId: 4,
      confianza: 80,
      ip: "10.0.0.1",
      userAgent: "sensor",
      ahora: AHORA,
    });

    expect(r.autorizado).toBe(false);
    expect(r.motivo).toMatch(/ya registró/i);
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: "DENEGADO" }),
    });
  });
});
