/** @jest-environment node */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@vercel/functions", () => ({ ipAddress: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: { usuario: { findUnique: jest.fn() } } }));
jest.mock("@/lib/auth", () => ({ ...jest.requireActual("@/lib/auth"), verifyJWT: jest.fn() }));
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
  cleanupRateLimitLogsIfNeeded: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ recordDeniedAccess: jest.fn() }));

import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { recordDeniedAccess } from "@/lib/audit";
import { proxy } from "./proxy";

const findUnique = prisma.usuario.findUnique as jest.Mock;
const verify = verifyJWT as jest.Mock;
const denied = recordDeniedAccess as jest.Mock;

const call = (path: string, withCookie = true, method = "GET") =>
  proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: withCookie ? { cookie: "authToken=tok" } : {},
    })
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
