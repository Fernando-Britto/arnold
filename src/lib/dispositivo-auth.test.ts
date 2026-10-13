/**
 * Autenticación de dispositivos (T-036, D-43 propuesta 4).
 * Prisma va mockeado; bcryptjs es real para probar la comparación del hash.
 */
import bcryptjs from "bcryptjs";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = { dispositivo: { findMany: jest.fn(), update: jest.fn() } };
  return { prisma };
});

import {
  generarTokenDispositivo,
  tokenDeDispositivo,
  encontrarDispositivoPorToken,
  autenticarDispositivo,
  DISPOSITIVO_TOKEN_HEADER,
} from "./dispositivo-auth";

const req = (headers: Record<string, string> = {}) => ({
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
});

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

const fila = (over: Record<string, unknown> = {}) => ({
  id: "dev-1",
  nombre: "Puerta principal",
  tipo: "PUERTA",
  estado: "ACTIVO",
  tokenHash: "hash",
  ultimoContacto: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

describe("generarTokenDispositivo", () => {
  it("genera un token de alta entropía y distinto en cada llamada", () => {
    const a = generarTokenDispositivo();
    const b = generarTokenDispositivo();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
  });
});

describe("tokenDeDispositivo", () => {
  it("lee el header x-dispositivo-token", () => {
    expect(tokenDeDispositivo(req({ [DISPOSITIVO_TOKEN_HEADER]: "tok-123" }))).toBe("tok-123");
  });

  it("cae al Authorization: Bearer cuando no hay header propio", () => {
    expect(tokenDeDispositivo(req({ authorization: "Bearer tok-bearer" }))).toBe("tok-bearer");
  });

  it("prefiere el header propio sobre Bearer", () => {
    expect(
      tokenDeDispositivo(req({ [DISPOSITIVO_TOKEN_HEADER]: "propio", authorization: "Bearer otro" }))
    ).toBe("propio");
  });

  it.each([{}, { authorization: "Basic abc" }, { authorization: "Bearer " }])(
    "devuelve null sin credenciales válidas %j",
    (headers) => {
      expect(tokenDeDispositivo(req(headers as Record<string, string>))).toBeNull();
    }
  );
});

describe("encontrarDispositivoPorToken", () => {
  it("encuentra el dispositivo cuyo hash coincide", async () => {
    const hash = await bcryptjs.hash("secreto", 4);
    const a = fila({ id: "a", tokenHash: hash });
    const b = fila({ id: "b", tokenHash: await bcryptjs.hash("otro", 4) });

    await expect(encontrarDispositivoPorToken("secreto", [b, a])).resolves.toMatchObject({ id: "a" });
  });

  it("devuelve null si ningún hash coincide", async () => {
    const hash = await bcryptjs.hash("secreto", 4);
    await expect(encontrarDispositivoPorToken("malo", [fila({ tokenHash: hash })])).resolves.toBeNull();
  });
});

describe("autenticarDispositivo", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sin token no consulta la base", async () => {
    const prisma = await mocks();
    await expect(autenticarDispositivo(req())).resolves.toBeNull();
    expect(prisma.dispositivo.findMany).not.toHaveBeenCalled();
  });

  it("token válido: busca solo ACTIVOS, actualiza ultimoContacto y devuelve el dispositivo", async () => {
    const prisma = await mocks();
    const hash = await bcryptjs.hash("tok-bueno", 4);
    (prisma.dispositivo.findMany as jest.Mock).mockResolvedValue([fila({ tokenHash: hash })]);

    const dev = await autenticarDispositivo(req({ [DISPOSITIVO_TOKEN_HEADER]: "tok-bueno" }));

    expect(prisma.dispositivo.findMany).toHaveBeenCalledWith({ where: { estado: "ACTIVO" } });
    expect(prisma.dispositivo.update).toHaveBeenCalledWith({
      where: { id: "dev-1" },
      data: { ultimoContacto: expect.any(Date) },
    });
    expect(dev).toMatchObject({ id: "dev-1", nombre: "Puerta principal" });
  });

  it("token inválido: devuelve null y no actualiza", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.findMany as jest.Mock).mockResolvedValue([fila({ tokenHash: await bcryptjs.hash("bueno", 4) })]);

    await expect(autenticarDispositivo(req({ [DISPOSITIVO_TOKEN_HEADER]: "malo" }))).resolves.toBeNull();
    expect(prisma.dispositivo.update).not.toHaveBeenCalled();
  });

  it("dispositivo INACTIVO: devuelve null aunque el token coincida", async () => {
    const prisma = await mocks();
    const hash = await bcryptjs.hash("tok-inactivo", 4);
    (prisma.dispositivo.findMany as jest.Mock).mockResolvedValue([fila({ estado: "INACTIVO", tokenHash: hash })]);

    await expect(autenticarDispositivo(req({ [DISPOSITIVO_TOKEN_HEADER]: "tok-inactivo" }))).resolves.toBeNull();
    expect(prisma.dispositivo.update).not.toHaveBeenCalled();
  });

  it("acepta el fallback Authorization: Bearer", async () => {
    const prisma = await mocks();
    const hash = await bcryptjs.hash("tok-bearer", 4);
    (prisma.dispositivo.findMany as jest.Mock).mockResolvedValue([fila({ tokenHash: hash })]);

    await expect(
      autenticarDispositivo(req({ authorization: "Bearer tok-bearer" }))
    ).resolves.toMatchObject({ id: "dev-1" });
  });
});
