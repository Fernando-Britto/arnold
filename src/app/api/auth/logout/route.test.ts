/** @jest-environment node */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/lib/token-revocation", () => ({
  revokeToken: jest.fn(),
  cleanupExpiredRevocations: jest.fn(),
}));

import { createJWT } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/api/auth";
import { revokeToken, cleanupExpiredRevocations } from "@/lib/token-revocation";
import { POST } from "./route";

const revoke = revokeToken as jest.Mock;
const cleanup = cleanupExpiredRevocations as jest.Mock;
const logout = (token?: string) =>
  POST(
    new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {},
    })
  );
const clearsCookie = (res: Response) => {
  const cookie = res.headers.get("set-cookie")!;
  expect(cookie).toMatch(new RegExp(`${AUTH_COOKIE_NAME}=;`));
  expect(cookie).toMatch(/Max-Age=0/i);
};

beforeEach(() => {
  jest.resetAllMocks();
  revoke.mockResolvedValue(true);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/auth/logout (revocación, P-06)", () => {
  it("con sesión válida: revoca el token (jti, usuario y vencimiento) y borra la cookie", async () => {
    const token = createJWT("u1", "24h", { rol: "SOCIO" });
    const res = await logout(token);

    expect(res.status).toBe(200);
    clearsCookie(res);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke.mock.calls[0][0]).toMatchObject({ sub: "u1", jti: expect.any(String), exp: expect.any(Number) });
    expect(cleanup).toHaveBeenCalledTimes(1); // limpieza oportunista de revocaciones vencidas
  });

  it("sin cookie: 200, borra la cookie y no revoca nada", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    clearsCookie(res);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("con un token inválido: 200, borra la cookie y no revoca", async () => {
    const res = await logout("no-es-un-jwt");
    expect(res.status).toBe(200);
    clearsCookie(res);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("si falla la base al revocar: igual cierra la sesión en el navegador y deja el error en el log", async () => {
    revoke.mockRejectedValue(new Error("db down"));
    const res = await logout(createJWT("u1", "24h"));
    expect(res.status).toBe(200);
    clearsCookie(res);
    expect(console.error).toHaveBeenCalled();
  });
});
