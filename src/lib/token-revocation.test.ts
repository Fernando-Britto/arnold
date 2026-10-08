import { prisma } from "@/lib/db";
import { cleanupExpiredRevocations, isTokenRevoked, revokeToken } from "./token-revocation";

jest.mock("@/lib/db", () => ({
  prisma: { tokenRevocation: { upsert: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn() } },
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (prisma as any).tokenRevocation;

beforeEach(() => jest.resetAllMocks());

describe("revokeToken", () => {
  it("guarda el jti con el usuario y el vencimiento del token (para poder limpiar después)", async () => {
    await revokeToken({ sub: "u1", jti: "j1", exp: 1_800_000_000 });
    expect(db.upsert).toHaveBeenCalledWith({
      where: { jti: "j1" },
      update: {},
      create: { jti: "j1", usuarioId: "u1", expiraEn: new Date(1_800_000_000 * 1000) },
    });
  });

  it("es idempotente: revocar dos veces el mismo token no falla (upsert)", async () => {
    await revokeToken({ sub: "u1", jti: "j1", exp: 1_800_000_000 });
    await revokeToken({ sub: "u1", jti: "j1", exp: 1_800_000_000 });
    expect(db.upsert).toHaveBeenCalledTimes(2);
  });

  it("un token sin jti o sin exp no se puede revocar: no toca la base", async () => {
    expect(await revokeToken({ sub: "u1", exp: 1_800_000_000 })).toBe(false);
    expect(await revokeToken({ sub: "u1", jti: "j1" })).toBe(false);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("devuelve true cuando se revocó", async () => {
    expect(await revokeToken({ sub: "u1", jti: "j1", exp: 1_800_000_000 })).toBe(true);
  });
});

describe("isTokenRevoked", () => {
  it("true si el jti está en la lista", async () => {
    db.findUnique.mockResolvedValue({ jti: "j1" });
    expect(await isTokenRevoked("j1")).toBe(true);
    expect(db.findUnique).toHaveBeenCalledWith({ where: { jti: "j1" }, select: { jti: true } });
  });

  it("false si no está", async () => {
    db.findUnique.mockResolvedValue(null);
    expect(await isTokenRevoked("j2")).toBe(false);
  });

  it("sin jti no consulta la base y devuelve false", async () => {
    expect(await isTokenRevoked(undefined)).toBe(false);
    expect(db.findUnique).not.toHaveBeenCalled();
  });
});

describe("cleanupExpiredRevocations", () => {
  it("borra solo las revocaciones de tokens que ya vencieron (ya no pasarían verifyJWT)", async () => {
    const now = new Date("2026-10-08T12:00:00Z");
    await cleanupExpiredRevocations(now);
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { expiraEn: { lt: now } } });
  });

  it("no lanza si falla: queda en el log", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    db.deleteMany.mockRejectedValue(new Error("db down"));
    await expect(cleanupExpiredRevocations()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
