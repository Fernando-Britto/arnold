/**
 * Capa API de socios (T-033): búsqueda por DNI para la pantalla "Registrar Pago".
 * Prisma va mockeado (igual que registrar-pago.test.ts): el motor remoto no es
 * alcanzable. El estado de cuota y el plan se calculan con las reglas puras (D-40).
 */
import { handleBuscarSocio, fetchSocioPorDni } from "./socios";
import { finDePeriodo, inicioDePeriodo } from "@/domains/pago/cuota";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    socio: { findUnique: jest.fn() },
    cuota: { findFirst: jest.fn() },
    pago: { findFirst: jest.fn() },
    asistencia: { findFirst: jest.fn() },
    configuracionDelSistema: { findFirst: jest.fn() },
  };
  return { prisma };
});

const d = (iso: string) => new Date(`${iso}-03:00`);
const DIA_MS = 24 * 60 * 60 * 1000;
const CONFIG = { diaLimitePago: 10, diaCorteAltaTardia: 20, periodoGracia: 0 };
const CONFIG_OFERTA_ACTIVA = {
  ...CONFIG,
  ofertaReactivacionActiva: true,
  diasSinAsistirParaOferta: 30,
  descuentoReactivacion: 10,
  enfriamientoOfertaDias: 180,
};

async function armarSocio() {
  const { prisma } = await import("@/lib/db");
  (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
    id: "socio-1",
    dni: "30123456",
    telefono: "+54 9 11 5555 5555",
    usuario: { nombre: "Ana García", email: "ana@example.com", password: "HASH-SECRETO" },
    membresiaAsignadaId: "plan-gold",
    membresiaAsignada: { id: "plan-gold", nombre: "Gold", precio: 30000 },
    estadoCuota: "AL_DIA",
    fechaAlta: d("2025-01-01T10:00:00"),
  });
  (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG);
  (prisma.asistencia.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.pago.findFirst as jest.Mock).mockResolvedValue(null);
  return prisma;
}

describe("handleBuscarSocio", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devuelve el socio con estadoCuota y plan calculados, sin password", async () => {
    const prisma = await armarSocio();
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue({
      fechaVencimiento: finDePeriodo("2026-10"),
    });

    const r = await handleBuscarSocio("30123456", d("2026-11-05T10:00:00"));

    expect(r).toEqual({
      id: "socio-1",
      nombre: "Ana García",
      dni: "30123456",
      email: "ana@example.com",
      telefono: "+54 9 11 5555 5555",
      membresia: { id: "plan-gold", nombre: "Gold", precio: 30000 },
      estadoCuota: "PENDIENTE",
      plan: {
        tipo: "RENOVACION",
        periodos: ["2026-11"],
        monto: 30000,
        cubreDesde: inicioDePeriodo("2026-11").toISOString(),
        cubreHasta: finDePeriodo("2026-11").toISOString(),
      },
      oferta: null,
    });
    expect(JSON.stringify(r)).not.toContain("HASH-SECRETO");
    expect((r as { password?: unknown }).password).toBeUndefined();
  });

  it("sin cuotas: SIN_CUOTA y plan de alta prorrateada", async () => {
    const prisma = await armarSocio();
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue(null);

    const r = await handleBuscarSocio("30123456", d("2026-11-16T18:00:00"));

    expect(r.estadoCuota).toBe("SIN_CUOTA");
    expect(r.plan?.tipo).toBe("ALTA_PRORRATEO");
    expect(r.plan?.monto).toBe(15000);
  });

  it("socio sin membresía: membresia null y plan null", async () => {
    const prisma = await armarSocio();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
      id: "socio-1",
      dni: "30123456",
      telefono: null,
      usuario: { nombre: "Ana", email: "ana@example.com", password: "HASH-SECRETO" },
      membresiaAsignadaId: null,
      membresiaAsignada: null,
    });
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue(null);

    const r = await handleBuscarSocio("30123456", d("2026-11-05T10:00:00"));

    expect(r.membresia).toBeNull();
    expect(r.plan).toBeNull();
    expect(r.estadoCuota).toBe("SIN_CUOTA");
  });

  it("usa la configuración por defecto (10/20/0) si no existe la fila", async () => {
    const prisma = await armarSocio();
    (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue(null);

    // día 21: pasó el corte por defecto (20) → cuota completa
    const r = await handleBuscarSocio("30123456", d("2026-11-21T10:00:00"));

    expect(r.plan?.tipo).toBe("ALTA_COMPLETA");
  });

  it("lanza NOT_FOUND si el DNI no existe", async () => {
    const prisma = await armarSocio();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(handleBuscarSocio("00000000", d("2026-11-05T10:00:00"))).rejects.toThrow("NOT_FOUND");
  });

  it("oferta null cuando el socio no es elegible (oferta activa pero con actividad reciente)", async () => {
    const prisma = await armarSocio();
    (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG_OFERTA_ACTIVA);
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue({ fechaVencimiento: finDePeriodo("2026-10") });
    const hoy = d("2026-11-15T10:00:00");
    (prisma.asistencia.findFirst as jest.Mock).mockResolvedValue({
      fechaHora: new Date(hoy.getTime() - 5 * DIA_MS),
    });

    const r = await handleBuscarSocio("30123456", hoy);

    expect(r.estadoCuota).toBe("VENCIDA");
    expect(r.oferta).toBeNull();
  });

  it("oferta con montoLista, descuentoPct y montoFinal cuando el socio es elegible", async () => {
    const prisma = await armarSocio();
    (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG_OFERTA_ACTIVA);
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue({ fechaVencimiento: finDePeriodo("2026-10") });
    const hoy = d("2026-11-15T10:00:00");
    (prisma.asistencia.findFirst as jest.Mock).mockResolvedValue({
      fechaHora: new Date(hoy.getTime() - 40 * DIA_MS),
    });

    const r = await handleBuscarSocio("30123456", hoy);

    expect(r.plan?.monto).toBe(30000);
    expect(r.oferta).toEqual({ montoLista: 30000, descuentoPct: 10, montoFinal: 27000 });
  });

  it("normaliza el DNI con puntos antes de buscar (30.123.456 → 30123456)", async () => {
    const prisma = await armarSocio();
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue(null);

    const r = await handleBuscarSocio("30.123.456", d("2026-11-05T10:00:00"));

    expect(prisma.socio.findUnique).toHaveBeenCalledWith({
      where: { dni: "30123456" },
      include: { usuario: true, membresiaAsignada: true },
    });
    expect(r.dni).toBe("30123456");
  });
});

describe("fetchSocioPorDni (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace GET /api/socios?dni=... sin headers de auth (la sesión va en cookie, PG-7)", async () => {
    const socio = { id: "socio-1", dni: "30123456", estadoCuota: "AL_DIA" };
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => socio,
    });

    const r = await fetchSocioPorDni("30123456");

    expect(r).toEqual(socio);
    expect(global.fetch).toHaveBeenCalledWith("/api/socios?dni=30123456");
  });
});
