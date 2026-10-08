/** @jest-environment node */
import { ipAddress } from "@vercel/functions";
import { getBestEffortClientIp, getTrustedClientIp } from "./client-ip";

jest.mock("@vercel/functions", () => ({ ipAddress: jest.fn() }));
const vercelIp = ipAddress as jest.Mock;
const req = (headers: Record<string, string> = {}) => new Request("http://localhost/x", { headers });

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  delete process.env.TRUST_PROXY_HEADERS;
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("getTrustedClientIp (para el límite de intentos)", () => {
  it("usa la IP de Vercel (la plataforma la fija, el cliente no puede falsearla)", () => {
    vercelIp.mockReturnValue("1.2.3.4");
    expect(getTrustedClientIp(req({ "x-forwarded-for": "6.6.6.6" }))).toBe("1.2.3.4");
  });

  it("fuera de Vercel IGNORA x-forwarded-for y x-real-ip por defecto (se podrían falsear para saltear el límite)", () => {
    vercelIp.mockReturnValue(undefined);
    expect(getTrustedClientIp(req({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" }))).toBe("unknown");
  });

  it("con TRUST_PROXY_HEADERS=true usa el primer salto de x-forwarded-for, luego x-real-ip", () => {
    vercelIp.mockReturnValue(undefined);
    process.env.TRUST_PROXY_HEADERS = "true";
    expect(getTrustedClientIp(req({ "x-forwarded-for": " 9.9.9.9 , 10.0.0.1" }))).toBe("9.9.9.9");
    expect(getTrustedClientIp(req({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(getTrustedClientIp(req())).toBe("unknown");
  });

  it("solo el valor exacto 'true' activa la confianza", () => {
    vercelIp.mockReturnValue(undefined);
    process.env.TRUST_PROXY_HEADERS = "1";
    expect(getTrustedClientIp(req({ "x-forwarded-for": "9.9.9.9" }))).toBe("unknown");
  });

  it("recorta valores absurdamente largos", () => {
    vercelIp.mockReturnValue(undefined);
    process.env.TRUST_PROXY_HEADERS = "true";
    expect(getTrustedClientIp(req({ "x-forwarded-for": "a".repeat(500) }))).toHaveLength(64);
  });
});

describe("getBestEffortClientIp (para la auditoría)", () => {
  it("Vercel → x-forwarded-for → x-real-ip → unknown, sin necesitar TRUST_PROXY_HEADERS", () => {
    vercelIp.mockReturnValue("1.2.3.4");
    expect(getBestEffortClientIp(req())).toBe("1.2.3.4");
    vercelIp.mockReturnValue(undefined);
    expect(getBestEffortClientIp(req({ "x-forwarded-for": "9.9.9.9, 1.1.1.1" }))).toBe("9.9.9.9");
    expect(getBestEffortClientIp(req({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(getBestEffortClientIp(req())).toBe("unknown");
  });
});

describe("aviso cuando no se puede determinar la IP", () => {
  const setEnv = (v: string) => Object.defineProperty(process.env, "NODE_ENV", { value: v, configurable: true });
  afterEach(() => setEnv("test"));

  it("en producción avisa UNA sola vez que el límite pasa a ser global", () => {
    setEnv("production");
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getTrustedClientIp: fresh } = require("./client-ip");
      fresh(req());
      fresh(req());
    });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect((console.warn as jest.Mock).mock.calls[0][0]).toContain("TRUST_PROXY_HEADERS");
  });

  it("fuera de producción no avisa", () => {
    getTrustedClientIp(req());
    expect(console.warn).not.toHaveBeenCalled();
  });
});
