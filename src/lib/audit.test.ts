/** @jest-environment node */
import { ipAddress } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRequestContext, recordAccessAttempt, recordDeniedAccess } from "./audit";

jest.mock("@vercel/functions", () => ({ ipAddress: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: { auditoriaAcceso: { create: jest.fn() } } }));
jest.mock("@/lib/rateLimit", () => ({ checkRateLimit: jest.fn() }));

const create = prisma.auditoriaAcceso.create as jest.Mock;
const vercelIp = ipAddress as jest.Mock;
const throttle = checkRateLimit as jest.Mock;
const req = (headers: Record<string, string> = {}) => new Request("http://localhost/x", { headers });

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("getRequestContext", () => {
  it("usa la IP que informa Vercel", () => {
    vercelIp.mockReturnValue("1.2.3.4");
    expect(getRequestContext(req({ "user-agent": "Mozilla/5.0" }))).toEqual({ ip: "1.2.3.4", userAgent: "Mozilla/5.0" });
  });

  it("fuera de Vercel cae a x-forwarded-for (primer valor), luego x-real-ip, luego 'unknown'", () => {
    vercelIp.mockReturnValue(undefined);
    expect(getRequestContext(req({ "x-forwarded-for": " 9.9.9.9 , 10.0.0.1" })).ip).toBe("9.9.9.9");
    expect(getRequestContext(req({ "x-real-ip": "8.8.8.8" })).ip).toBe("8.8.8.8");
    expect(getRequestContext(req()).ip).toBe("unknown");
  });

  it("user-agent ausente → 'unknown'; los demasiado largos se recortan", () => {
    vercelIp.mockReturnValue("1.1.1.1");
    expect(getRequestContext(req()).userAgent).toBe("unknown");
    expect(getRequestContext(req({ "user-agent": "x".repeat(1000) })).userAgent).toHaveLength(255);
  });
});

describe("recordAccessAttempt", () => {
  const ctx = { ip: "1.2.3.4", userAgent: "UA" };

  it("escribe la fila con actor, acción, resultado y contexto", async () => {
    await recordAccessAttempt({ usuarioId: "u1", accion: "LOGIN", resultado: "ALLOW", context: ctx });
    expect(create).toHaveBeenCalledWith({
      data: { usuarioId: "u1", accion: "LOGIN", resultado: "ALLOW", motivo: null, ipAddress: "1.2.3.4", userAgent: "UA" },
    });
  });

  it("sin usuario (login con email desconocido) guarda usuarioId null y el motivo", async () => {
    await recordAccessAttempt({ accion: "LOGIN", resultado: "DENY", motivo: "AUTH_INVALID", context: ctx });
    expect(create.mock.calls[0][0].data).toMatchObject({ usuarioId: null, motivo: "AUTH_INVALID" });
  });

  it("recorta motivos largos", async () => {
    await recordAccessAttempt({ accion: "ACCESS_DENIED", resultado: "DENY", motivo: "m".repeat(1000), context: ctx });
    expect(create.mock.calls[0][0].data.motivo).toHaveLength(255);
  });

  it("NUNCA lanza: si la base falla deja el detalle en el log y sigue", async () => {
    create.mockRejectedValue(new Error("db down"));
    await expect(
      recordAccessAttempt({ accion: "LOGIN", resultado: "DENY", context: ctx })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("recordDeniedAccess (RBAC en el proxy)", () => {
  beforeEach(() => vercelIp.mockReturnValue("5.5.5.5"));
  const input = () => ({
    request: req({ "user-agent": "UA" }),
    usuarioId: "u1",
    method: "GET",
    pathname: "/api/clientes",
  });

  it("registra ACCESS_DENIED/DENY con el usuario y 'MÉTODO ruta' como motivo", async () => {
    throttle.mockResolvedValue(true);
    await recordDeniedAccess(input());
    expect(create).toHaveBeenCalledWith({
      data: {
        usuarioId: "u1", accion: "ACCESS_DENIED", resultado: "DENY",
        motivo: "GET /api/clientes", ipAddress: "5.5.5.5", userAgent: "UA",
      },
    });
  });

  it("limita las filas por usuario (anti-inundación): pasado el tope, no escribe", async () => {
    throttle.mockResolvedValue(false);
    await recordDeniedAccess(input());
    expect(throttle).toHaveBeenCalledWith("u1", "audit:access-denied", 10);
    expect(create).not.toHaveBeenCalled();
  });

  it("nunca lanza, ni siquiera si falla el limitador", async () => {
    throttle.mockRejectedValue(new Error("db down"));
    await expect(recordDeniedAccess(input())).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });
});
