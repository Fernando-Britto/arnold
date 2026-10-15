/** @jest-environment node */
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

jest.unmock("next/server");
jest.mock("@vercel/functions", () => ({ ipAddress: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: { usuario: { findUnique: jest.fn() } } }));
jest.mock("@/lib/auth", () => ({ ...jest.requireActual("@/lib/auth"), verifyJWT: jest.fn() }));
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
  cleanupRateLimitLogsIfNeeded: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ recordDeniedAccess: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/token-revocation", () => ({ isTokenRevoked: jest.fn().mockResolvedValue(false) }));

import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { recordDeniedAccess } from "@/lib/audit";
import { isTokenRevoked } from "@/lib/token-revocation";
import { proxy } from "./proxy";

const findUnique = prisma.usuario.findUnique as jest.Mock;
const verify = verifyJWT as jest.Mock;
const denied = recordDeniedAccess as jest.Mock;
const revoked = isTokenRevoked as jest.Mock;

const call = (path: string, withCookie = true, method = "GET", event: NextFetchEvent = { waitUntil: jest.fn() } as unknown as NextFetchEvent) =>
  proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: withCookie ? { cookie: "authToken=tok" } : {},
    }),
    event
  );

const loginAs = (rol: string, over = {}) => {
  verify.mockReturnValue({ sub: "u1" });
  findUnique.mockResolvedValue({ id: "u1", rol, estado: "ACTIVO", deletedAt: null, ...over });
};

beforeEach(() => {
  jest.clearAllMocks();
  verify.mockReset();
  findUnique.mockReset();
});

describe("proxy — auditoría de accesos denegados (P-15)", () => {
  it("API prohibida para el rol (403) → se registra con usuario, método y ruta", async () => {
    loginAs("SOCIO");
    const res = await call("/api/clientes");
    expect(res.status).toBe(403);
    expect(denied).toHaveBeenCalledTimes(1);
    expect(denied).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: "u1", method: "GET", pathname: "/api/clientes" })
    );
  });

  it("página prohibida para el rol (redirect a su home) → también se registra", async () => {
    loginAs("SOCIO");
    const res = await call("/clientes");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/home-socio");
    expect(denied).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: "u1", pathname: "/clientes" }));
  });

  it("acceso permitido → no se registra nada", async () => {
    loginAs("ADMINISTRADOR");
    const res = await call("/api/clientes");
    expect(res.status).toBe(200);
    expect(denied).not.toHaveBeenCalled();
  });

  it("sin sesión (401) → no se registra: no hay actor y se podría inundar la tabla", async () => {
    const res = await call("/api/clientes", false);
    expect(res.status).toBe(401);
    expect(denied).not.toHaveBeenCalled();
  });

  it("token inválido o usuario deshabilitado (401) → no se registra", async () => {
    verify.mockReturnValue(null);
    expect((await call("/api/clientes")).status).toBe(401);
    loginAs("SOCIO", { estado: "INACTIVO" });
    expect((await call("/api/clientes")).status).toBe(401);
    expect(denied).not.toHaveBeenCalled();
  });
});

describe("proxy — auditoría no bloqueante (F / P-38)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReset();
    findUnique.mockReset();
    revoked.mockResolvedValue(false);
    denied.mockReset();
  });

  it("responde 403 sin esperar la auditoría y la delega a event.waitUntil", async () => {
    loginAs("SOCIO");
    let releaseAudit!: () => void;
    denied.mockImplementation(
      () => new Promise<void>((resolve) => { releaseAudit = resolve; })
    );
    const waitUntil = jest.fn();
    const event = { waitUntil } as unknown as NextFetchEvent;

    const res = await Promise.race([
      call("/api/clientes", true, "GET", event),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("la respuesta quedó bloqueada esperando la auditoría")), 250)
      ),
    ]);

    expect(res.status).toBe(403);
    expect(denied).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    releaseAudit();
  });

  it("sin event igual responde y una auditoría que falla no rompe la request", async () => {
    loginAs("SOCIO");
    denied.mockRejectedValue(new Error("db caída"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await proxy(
      new NextRequest("http://localhost:3000/api/clientes", {
        method: "GET",
        headers: { cookie: "authToken=tok" },
      })
    );
    expect(res.status).toBe(403);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("proxy — carve-out de dispositivo (T-036)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReset();
    findUnique.mockReset();
  });

  it("la página /puerta pasa sin sesión y ni siquiera verifica un JWT", async () => {
    const res = await call("/puerta", false);
    expect(res.status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("POST /api/dispositivo/acceso pasa sin sesión (lo autentica el token del dispositivo)", async () => {
    const res = await call("/api/dispositivo/acceso", false, "POST");
    expect(res.status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
  });

  it("la API de administración /api/dispositivos SIGUE exigiendo sesión", async () => {
    const res = await call("/api/dispositivos", false);
    expect(res.status).toBe(401);
  });

  it("las rutas protegidas de siempre siguen bloqueadas sin sesión", async () => {
    expect((await call("/api/clientes", false)).status).toBe(401);
    expect((await call("/api/acceso/check-in", false, "POST")).status).toBe(401);
    expect((await call("/clientes", false)).status).toBe(307);
  });
});

describe("proxy — límite de intentos de login por IP (P-16)", () => {
  const rate = jest.requireMock("@/lib/rateLimit").checkRateLimit as jest.Mock;
  const login = (headers: Record<string, string> = {}) =>
    proxy(new NextRequest("http://localhost:3000/api/auth/login", { method: "POST", headers }));

  beforeEach(() => {
    rate.mockReset();
    rate.mockResolvedValue(true);
    delete process.env.TRUST_PROXY_HEADERS;
  });
  afterAll(() => {
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it("fuera de Vercel y sin proxy confiable, un x-forwarded-for falseado NO cambia la clave del límite", async () => {
    await login({ "x-forwarded-for": "6.6.6.6" });
    expect(rate).toHaveBeenCalledWith("unknown", "/api/auth/login", 8);
  });

  it("con TRUST_PROXY_HEADERS=true cada IP real tiene su propio contador", async () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    await login({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(rate).toHaveBeenCalledWith("9.9.9.9", "/api/auth/login", 8);
  });

  it("pasado el límite responde 429", async () => {
    rate.mockResolvedValue(false);
    const res = await login();
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
  });

  it("POST /api/auth/register ya no es pública: sin sesión → 401 y no usa el límite de auth (P-10)", async () => {
    rate.mockClear();
    const res = await call("/api/auth/register", false, "POST");
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(rate).not.toHaveBeenCalledWith("unknown", "/api/auth/register", 8);
  });
});

describe("proxy — límite por IP en logout y refresh (U)", () => {
  const rate = jest.requireMock("@/lib/rateLimit").checkRateLimit as jest.Mock;
  const post = (path: string) =>
    proxy(new NextRequest(`http://localhost:3000${path}`, { method: "POST" }));

  beforeEach(() => {
    rate.mockReset();
    rate.mockResolvedValue(true);
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it("logout pasado el límite responde 429 y usa el umbral de 8/min", async () => {
    rate.mockResolvedValue(false);
    const res = await post("/api/auth/logout");
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(rate).toHaveBeenCalledWith("unknown", "/api/auth/logout", 8);
  });

  it("refresh pasado el límite responde 429 y usa un umbral más alto (30/min)", async () => {
    rate.mockResolvedValue(false);
    const res = await post("/api/auth/refresh");
    expect(res.status).toBe(429);
    expect(rate).toHaveBeenCalledWith("unknown", "/api/auth/refresh", 30);
  });

  it("dentro del límite, logout y refresh pasan", async () => {
    expect((await post("/api/auth/logout")).status).toBe(200);
    expect((await post("/api/auth/refresh")).status).toBe(200);
  });
});

describe("proxy — tokens revocados (P-06)", () => {
  beforeEach(() => {
    revoked.mockReset();
    revoked.mockResolvedValue(false);
    // el bloque anterior (P-16) deja el límite de intentos en "excedido": se reinicia
    const rate = jest.requireMock("@/lib/rateLimit").checkRateLimit as jest.Mock;
    rate.mockReset();
    rate.mockResolvedValue(true);
  });

  it("token revocado (logout) → 401 TOKEN_INVALID aunque la firma y el usuario sean válidos", async () => {
    verify.mockReturnValue({ sub: "u1", jti: "j-revocado" });
    findUnique.mockResolvedValue({ id: "u1", rol: "ADMINISTRADOR", estado: "ACTIVO", deletedAt: null });
    revoked.mockResolvedValue(true);

    const res = await call("/api/clientes");

    expect(revoked).toHaveBeenCalledWith("j-revocado");
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("TOKEN_INVALID");
  });

  it("una página con token revocado redirige a /login", async () => {
    verify.mockReturnValue({ sub: "u1", jti: "j-revocado" });
    findUnique.mockResolvedValue({ id: "u1", rol: "ADMINISTRADOR", estado: "ACTIVO", deletedAt: null });
    revoked.mockResolvedValue(true);

    const res = await call("/clientes");

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("token no revocado → pasa", async () => {
    verify.mockReturnValue({ sub: "u1", jti: "j-ok" });
    findUnique.mockResolvedValue({ id: "u1", rol: "ADMINISTRADOR", estado: "ACTIVO", deletedAt: null });
    expect((await call("/api/clientes")).status).toBe(200);
  });

  it("no consulta revocaciones cuando el token ni siquiera verifica", async () => {
    verify.mockReturnValue(null);
    await call("/api/clientes");
    expect(revoked).not.toHaveBeenCalled();
  });

  it("un token revocado no deja rastro de ACCESS_DENIED (es una sesión inválida, no un permiso denegado)", async () => {
    verify.mockReturnValue({ sub: "u1", jti: "j-revocado" });
    findUnique.mockResolvedValue({ id: "u1", rol: "SOCIO", estado: "ACTIVO", deletedAt: null });
    revoked.mockResolvedValue(true);
    await call("/api/clientes");
    expect(denied).not.toHaveBeenCalled();
  });
});
