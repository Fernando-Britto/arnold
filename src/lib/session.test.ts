import { cookies } from "next/headers";
import { createJWT } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isTokenRevoked } from "@/lib/token-revocation";
import { getSessionUser } from "./session";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/db", () => ({ prisma: { usuario: { findUnique: jest.fn() } } }));
jest.mock("@/lib/token-revocation", () => ({ isTokenRevoked: jest.fn() }));

const findUnique = prisma.usuario.findUnique as jest.Mock;
const revoked = isTokenRevoked as jest.Mock;

const withCookie = (value?: string) =>
  (cookies as jest.Mock).mockResolvedValue({ get: () => (value ? { value } : undefined) });
const token = (over: Record<string, unknown> = {}, exp: string | number = 3600) =>
  createJWT("u1", exp, { rol: "RECEPCIONISTA", email: "a@arnold.gym", nombre: "Ana", ...over });

const activeUser = { estado: "ACTIVO", deletedAt: null };

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue(activeUser);
  revoked.mockReset();
  revoked.mockResolvedValue(false);
});

describe("getSessionUser", () => {
  it("sin cookie → null", async () => {
    withCookie();
    expect(await getSessionUser()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("token inválido → null", async () => {
    withCookie("basura");
    expect(await getSessionUser()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
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

describe("getSessionUser — estado/revocación en cada render (L / P-39)", () => {
  it("usuario inexistente → null aunque la firma y los claims sean válidos", async () => {
    withCookie(token());
    findUnique.mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
  });

  it("usuario no ACTIVO → null", async () => {
    withCookie(token());
    findUnique.mockResolvedValue({ estado: "INACTIVO", deletedAt: null });
    expect(await getSessionUser()).toBeNull();
  });

  it("usuario borrado (deletedAt) → null", async () => {
    withCookie(token());
    findUnique.mockResolvedValue({ estado: "ACTIVO", deletedAt: new Date() });
    expect(await getSessionUser()).toBeNull();
  });

  it("token revocado → null", async () => {
    withCookie(token());
    revoked.mockResolvedValue(true);
    expect(await getSessionUser()).toBeNull();
  });

  it("consulta usuario y revocación en paralelo (2 donde, 1 findUnique)", async () => {
    withCookie(token());
    await getSessionUser();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { estado: true, deletedAt: true },
    });
    expect(revoked).toHaveBeenCalledTimes(1);
  });
});
