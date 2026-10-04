import { cookies } from "next/headers";
import { createJWT } from "@/lib/auth";
import { getSessionUser } from "./session";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: {} }));

const withCookie = (value?: string) =>
  (cookies as jest.Mock).mockResolvedValue({ get: () => (value ? { value } : undefined) });
const token = (over: Record<string, unknown> = {}, exp: string | number = 3600) =>
  createJWT("u1", exp, { rol: "RECEPCIONISTA", email: "a@arnold.gym", nombre: "Ana", ...over });

describe("getSessionUser", () => {
  it("sin cookie → null", async () => {
    withCookie();
    expect(await getSessionUser()).toBeNull();
  });
  it("token inválido → null", async () => {
    withCookie("basura");
    expect(await getSessionUser()).toBeNull();
  });
  it("token expirado → null", async () => {
    withCookie(token({}, -10));
    expect(await getSessionUser()).toBeNull();
  });
  it.each([{ rol: undefined }, { rol: "HACKER" }, { email: undefined }, { nombre: undefined }])(
    "payload incompleto o rol inválido %j → null",
    async (over) => {
      withCookie(token(over));
      expect(await getSessionUser()).toBeNull();
    }
  );
  it("token válido → SessionUser exacto (sin campos extra)", async () => {
    withCookie(token());
    expect(await getSessionUser()).toEqual({
      id: "u1", nombre: "Ana", email: "a@arnold.gym", rol: "RECEPCIONISTA",
    });
  });
});
