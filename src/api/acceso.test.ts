/**
 * Capa de servicio del check-in por DNI + PIN (T-035, D-47) y del set de PIN.
 * Prisma, bcrypt y rate limit van mockeados: el motor remoto no es alcanzable.
 */
import {
  handleSetPin,
  handleCheckIn,
  validarPin,
  checkIn,
  setPin,
  VENTANA_ANTI_PASSBACK_MINUTOS,
  LIMITE_INTENTOS_CHECK_IN_POR_MINUTO,
  MENSAJE_IDENTIDAD_INVALIDA,
} from "./acceso";
import { finDePeriodo } from "@/domains/pago/cuota";
import { hashPassword, comparePassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

jest.mock("@/lib/db", () => {
  const store = { asistencias: [] as unknown[], auditorias: [] as unknown[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    socio: { findUnique: jest.fn(), update: jest.fn() },
    cuota: { findFirst: jest.fn() },
    configuracionDelSistema: { findFirst: jest.fn() },
    asistencia: { findFirst: jest.fn(), create: jest.fn() },
    auditoriaAcceso: { create: jest.fn() },
  };
  // `$transaction(callback)` con rollback sobre un store en memoria: si el callback
  // rechaza, las escrituras de `tx` se descartan (como la transacción real de Prisma).
  prisma.$transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
    const snapshot = { asistencias: [...store.asistencias], auditorias: [...store.auditorias] };
    try {
      return await callback(prisma);
    } catch (error) {
      store.asistencias = snapshot.asistencias;
      store.auditorias = snapshot.auditorias;
      throw error;
    }
  });
  prisma.__store = store;
  return { prisma };
});
jest.mock("@/lib/auth", () => ({
  hashPassword: jest.fn(async () => "HASH-DEL-PIN"),
  comparePassword: jest.fn(),
}));
jest.mock("@/lib/rateLimit", () => ({ checkRateLimit: jest.fn(async () => true) }));

const d = (iso: string) => new Date(`${iso}-03:00`);
const CONFIG = { diaLimitePago: 10, periodoGracia: 0 };
const AHORA = d("2026-11-05T10:00:00");

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

async function armarSocio(overrides: Record<string, unknown> = {}) {
  const prisma = await mocks();
  (prisma.socio.findUnique as jest.Mock).mockResolvedValue({
    id: "socio-1",
    dni: "30123456",
    estadoCuota: "AL_DIA",
    pinHash: "HASH-DEL-PIN",
    usuario: { nombre: "Ana García", password: "NO-DEBE-VIAJAR" },
    membresiaAsignada: { nombre: "Gold" },
    ...overrides,
  });
  (prisma.configuracionDelSistema.findFirst as jest.Mock).mockResolvedValue(CONFIG);
  (prisma.cuota.findFirst as jest.Mock).mockResolvedValue({ fechaVencimiento: finDePeriodo("2026-11") });
  (prisma.asistencia.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.asistencia.create as jest.Mock).mockResolvedValue({ id: "asist-1" });
  (prisma.auditoriaAcceso.create as jest.Mock).mockResolvedValue({ id: "aud-1" });
  return prisma;
}

describe("validarPin", () => {
  it.each(["0000", "1234", "9999"])("acepta %s", (pin) => {
    expect(validarPin(pin)).toBe(true);
  });
  it.each(["", "123", "12345", "12a4", "12 4", "abcd", "12.4"])("rechaza %s", (pin) => {
    expect(validarPin(pin)).toBe(false);
  });
});

describe("handleSetPin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hashea el PIN y lo guarda sin devolverlo", async () => {
    const prisma = await armarSocio();
    (prisma.socio.update as jest.Mock).mockResolvedValue({ id: "socio-1", pinHash: "HASH-DEL-PIN" });

    const r = await handleSetPin("socio-1", "4821");

    expect(hashPassword).toHaveBeenCalledWith("4821");
    expect(prisma.socio.update).toHaveBeenCalledWith({
      where: { id: "socio-1" },
      data: { pinHash: "HASH-DEL-PIN" },
    });
    expect(r).toEqual({ success: true });
    expect(JSON.stringify(r)).not.toContain("HASH-DEL-PIN");
  });

  it.each(["123", "12345", "12a4", ""])("rechaza el PIN inválido %s sin tocar la base", async (pin) => {
    const prisma = await armarSocio();

    await expect(handleSetPin("socio-1", pin)).rejects.toThrow(/VALIDATION_ERROR/);

    expect(prisma.socio.update).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it("lanza NOT_FOUND si el socio no existe", async () => {
    const prisma = await armarSocio();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(handleSetPin("nope", "1234")).rejects.toThrow("NOT_FOUND");
    expect(prisma.socio.update).not.toHaveBeenCalled();
  });
});

describe("handleCheckIn — identidad (DNI + PIN)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("DNI inexistente: DENEGADO genérico, auditoría DENY sin Asistencia", async () => {
    const prisma = await armarSocio();
    (prisma.socio.findUnique as jest.Mock).mockResolvedValue(null);

    const r = await handleCheckIn({ dni: "00000000", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toBe(MENSAJE_IDENTIDAD_INVALIDA);
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: "CHECK_IN", resultado: "DENY", socioId: null }),
    });
    expect(prisma.asistencia.create).not.toHaveBeenCalled();
    expect(comparePassword).not.toHaveBeenCalled();
  });

  it("PIN incorrecto: DENEGADO genérico (no revela cuál falló), auditoría DENY", async () => {
    const prisma = await armarSocio();
    (comparePassword as jest.Mock).mockResolvedValue(false);

    const r = await handleCheckIn({ dni: "30123456", pin: "9999", ahora: AHORA });

    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toBe(MENSAJE_IDENTIDAD_INVALIDA);
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resultado: "DENY", socioId: "socio-1" }),
    });
    expect(prisma.asistencia.create).not.toHaveBeenCalled();
    expect(r.socio).toBeUndefined();
  });

  it("socio sin PIN definido: DENEGADO genérico", async () => {
    const prisma = await armarSocio({ pinHash: null });

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toBe(MENSAJE_IDENTIDAD_INVALIDA);
    expect(prisma.asistencia.create).not.toHaveBeenCalled();
  });
});

describe("handleCheckIn — decisión y registros", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (comparePassword as jest.Mock).mockResolvedValue(true);
  });

  it("AL_DIA: PERMITIDO, Asistencia DNI_PIN + auditoría ALLOW", async () => {
    const prisma = await armarSocio();

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA, ip: "10.0.0.1", userAgent: "kiosco" });

    expect(r.resultado).toBe("PERMITIDO");
    expect(r.estadoCuota).toBe("AL_DIA");
    expect(r.socio).toEqual({ nombre: "Ana García", membresia: "Gold" });
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ socioId: "socio-1", estado: "PERMITIDO", metodo: "DNI_PIN" }),
    });
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: "CHECK_IN", resultado: "ALLOW", socioId: "socio-1", ipAddress: "10.0.0.1" }),
    });
    expect(JSON.stringify(r)).not.toContain("NO-DEBE-VIAJAR");
    expect(JSON.stringify(r)).not.toContain("HASH-DEL-PIN");
  });

  it("PENDIENTE: PERMITIDO_CON_AVISO con el día límite", async () => {
    await armarSocio();
    const prisma = await mocks();
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue({ fechaVencimiento: finDePeriodo("2026-10") });

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("PERMITIDO_CON_AVISO");
    expect(r.motivo).toMatch(/hasta el día 10/);
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: "PERMITIDO", metodo: "DNI_PIN" }),
    });
  });

  it("VENCIDA: DENEGADO con Asistencia DENEGADO", async () => {
    await armarSocio();
    const prisma = await mocks();
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue({ fechaVencimiento: finDePeriodo("2026-09") });

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/vencida/i);
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: "DENEGADO", metodo: "DNI_PIN" }),
    });
  });

  it("SIN_CUOTA: DENEGADO", async () => {
    await armarSocio();
    const prisma = await mocks();
    (prisma.cuota.findFirst as jest.Mock).mockResolvedValue(null);

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("DENEGADO");
  });

  it("cuenta INACTIVA: DENEGADO aunque el pago esté al día", async () => {
    const prisma = await armarSocio({ estadoCuota: "INACTIVA" });

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/inactiva/i);
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: "DENEGADO" }),
    });
  });

  it("anti-passback: un ingreso PERMITIDO dentro de la ventana niega", async () => {
    const prisma = await armarSocio();
    (prisma.asistencia.findFirst as jest.Mock).mockResolvedValue({ id: "asist-prev" });

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("DENEGADO");
    expect(r.motivo).toMatch(/ya registró/i);
    expect(prisma.asistencia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: "DENEGADO" }),
    });
  });

  it("busca el ingreso previo en la ventana de anti-passback (60 min)", async () => {
    const prisma = await armarSocio();

    await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    const desde = new Date(AHORA.getTime() - VENTANA_ANTI_PASSBACK_MINUTOS * 60 * 1000);
    expect(prisma.asistencia.findFirst).toHaveBeenCalledWith({
      where: { socioId: "socio-1", estado: "PERMITIDO", fechaHora: { gte: desde } },
      orderBy: { fechaHora: "desc" },
    });
  });

  it("rate limit excedido: DENEGADO RATE_LIMITED sin consultar la base", async () => {
    const prisma = await armarSocio();
    (checkRateLimit as jest.Mock).mockResolvedValueOnce(false);

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA, ip: "10.0.0.9" });

    expect(r.resultado).toBe("DENEGADO");
    expect(r.code).toBe("RATE_LIMITED");
    expect(checkRateLimit).toHaveBeenCalledWith("10.0.0.9", expect.any(String), LIMITE_INTENTOS_CHECK_IN_POR_MINUTO);
    expect(prisma.socio.findUnique).not.toHaveBeenCalled();
    expect(prisma.asistencia.create).not.toHaveBeenCalled();
  });
});

describe("handleCheckIn — atomicidad (Asistencia + Auditoría en UNA transacción)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (comparePassword as jest.Mock).mockResolvedValue(true);
  });

  it("registra el ingreso y su auditoría dentro de una sola transacción", async () => {
    const prisma = await armarSocio();

    const r = await handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA });

    expect(r.resultado).toBe("PERMITIDO");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.asistencia.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditoriaAcceso.create).toHaveBeenCalledTimes(1);
  });

  it("si falla la auditoría, NO persiste el ingreso (rollback)", async () => {
    const prisma = await armarSocio();
    const store = (prisma as unknown as { __store: { asistencias: unknown[] } }).__store;
    (prisma.asistencia.create as jest.Mock).mockImplementation(async ({ data }: { data: unknown }) => {
      store.asistencias.push(data);
      return { id: "asist-1" };
    });
    (prisma.auditoriaAcceso.create as jest.Mock).mockImplementation(async () => {
      throw new Error("boom-auditoria");
    });

    await expect(
      handleCheckIn({ dni: "30123456", pin: "1234", ahora: AHORA })
    ).rejects.toThrow("boom-auditoria");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(store.asistencias).toHaveLength(0);
  });
});

describe("checkIn (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace POST /api/acceso/check-in con el DNI y el PIN", async () => {
    const respuesta = { resultado: "PERMITIDO", socio: { nombre: "Ana", membresia: "Gold" }, estadoCuota: "AL_DIA" };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => respuesta });

    const r = await checkIn({ dni: "30123456", pin: "1234" });

    expect(r).toEqual(respuesta);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/acceso/check-in",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ dni: "30123456", pin: "1234" }) })
    );
  });
});

describe("setPin (fetch client)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace POST /api/socios/{id}/pin", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    const r = await setPin("socio-1", "1234");

    expect(r).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/socios/socio-1/pin",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ pin: "1234" }) })
    );
  });
});
