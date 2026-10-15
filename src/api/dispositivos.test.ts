/**
 * Servicio de dispositivos (T-036): alta con token en claro UNA sola vez (como tempPassword),
 * listado sin token, y el fetch cliente del check-in de puerta.
 */
import {
  handleDispositivoCreate,
  handleDispositivoList,
  handleDispositivoEstado,
  accesoDispositivo,
} from "./dispositivos";
import { hashPassword } from "@/lib/auth";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    dispositivo: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  return { prisma };
});
jest.mock("@/lib/auth", () => ({ hashPassword: jest.fn(async () => "HASH-DEL-TOKEN") }));

async function mocks() {
  const { prisma } = await import("@/lib/db");
  return prisma;
}

const creado = (over: Record<string, unknown> = {}) => ({
  id: "dev-1",
  nombre: "Puerta principal",
  tipo: "PUERTA",
  estado: "ACTIVO",
  tokenHash: "HASH-DEL-TOKEN",
  ultimoContacto: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

describe("handleDispositivoCreate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hashea el token, lo guarda y lo devuelve en claro UNA sola vez", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.create as jest.Mock).mockResolvedValue(creado());

    const r = await handleDispositivoCreate({ nombre: "Puerta principal" });

    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(prisma.dispositivo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nombre: "Puerta principal", tipo: "PUERTA", tokenHash: "HASH-DEL-TOKEN" }),
    });
    expect(typeof r.token).toBe("string");
    expect(r.token.length).toBeGreaterThanOrEqual(32);
    expect(r.token).not.toBe("HASH-DEL-TOKEN");
    expect(r.dispositivo).toMatchObject({ id: "dev-1", nombre: "Puerta principal", tipo: "PUERTA", estado: "ACTIVO" });
    // El hash nunca sale en la respuesta.
    expect(JSON.stringify(r)).not.toContain("HASH-DEL-TOKEN");
    expect(JSON.stringify(r.dispositivo)).not.toContain("tokenHash");
  });

  it("AC-7: guarda el prefijo de 8 chars del token para poder buscarlo por selector", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.create as jest.Mock).mockResolvedValue(creado());

    const r = await handleDispositivoCreate({ nombre: "Puerta principal" });

    expect(prisma.dispositivo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tokenPrefix: r.token.slice(0, 8) }),
    });
  });

  it("acepta tipo RECEPCION explícito", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.create as jest.Mock).mockResolvedValue(creado({ tipo: "RECEPCION" }));

    await handleDispositivoCreate({ nombre: "Tablet recepción", tipo: "RECEPCION" });

    expect(prisma.dispositivo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: "RECEPCION" }),
    });
  });

  it.each([undefined, "", "   "])("rechaza el nombre inválido %j sin tocar la base", async (nombre) => {
    const prisma = await mocks();
    await expect(handleDispositivoCreate({ nombre })).rejects.toThrow(/VALIDATION_ERROR/);
    expect(prisma.dispositivo.create).not.toHaveBeenCalled();
  });

  it("rechaza un tipo inválido", async () => {
    const prisma = await mocks();
    await expect(handleDispositivoCreate({ nombre: "X", tipo: "OTRO" })).rejects.toThrow(/VALIDATION_ERROR/);
    expect(prisma.dispositivo.create).not.toHaveBeenCalled();
  });
});

describe("handleDispositivoList", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lista dispositivos SIN el token ni su hash", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.findMany as jest.Mock).mockResolvedValue([creado(), creado({ id: "dev-2" })]);

    const r = await handleDispositivoList();

    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ id: "dev-1", nombre: "Puerta principal" });
    expect(JSON.stringify(r)).not.toContain("HASH-DEL-TOKEN");
    expect(JSON.stringify(r)).not.toContain("tokenHash");
  });
});

describe("handleDispositivoEstado (AC-10)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("desactiva (INACTIVO) un dispositivo existente sin exponer token ni hash", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.findUnique as jest.Mock).mockResolvedValue(creado());
    (prisma.dispositivo.update as jest.Mock).mockResolvedValue(creado({ estado: "INACTIVO" }));

    const r = await handleDispositivoEstado("dev-1", "INACTIVO");

    expect(prisma.dispositivo.update).toHaveBeenCalledWith({
      where: { id: "dev-1" },
      data: { estado: "INACTIVO" },
    });
    expect(r).toMatchObject({ id: "dev-1", estado: "INACTIVO" });
    expect(JSON.stringify(r)).not.toContain("tokenHash");
  });

  it("permite reactivar (ACTIVO)", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.findUnique as jest.Mock).mockResolvedValue(creado({ estado: "INACTIVO" }));
    (prisma.dispositivo.update as jest.Mock).mockResolvedValue(creado({ estado: "ACTIVO" }));

    await expect(handleDispositivoEstado("dev-1", "ACTIVO")).resolves.toMatchObject({ estado: "ACTIVO" });
  });

  it("estado inválido → VALIDATION_ERROR sin tocar la base", async () => {
    const prisma = await mocks();
    await expect(handleDispositivoEstado("dev-1", "APAGADO")).rejects.toThrow(/VALIDATION_ERROR/);
    expect(prisma.dispositivo.findUnique).not.toHaveBeenCalled();
    expect(prisma.dispositivo.update).not.toHaveBeenCalled();
  });

  it("dispositivo inexistente → NOT_FOUND", async () => {
    const prisma = await mocks();
    (prisma.dispositivo.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(handleDispositivoEstado("nope", "INACTIVO")).rejects.toThrow(/NOT_FOUND/);
    expect(prisma.dispositivo.update).not.toHaveBeenCalled();
  });
});

describe("accesoDispositivo (fetch cliente)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hace POST /api/dispositivo/acceso con el token en el header del dispositivo", async () => {
    const respuesta = { resultado: "PERMITIDO", nombre: "Ana García" };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => respuesta });

    const r = await accesoDispositivo({ dni: "30123456", pin: "1234" }, "tok-dev");

    expect(r).toEqual(respuesta);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dispositivo/acceso",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-dispositivo-token": "tok-dev" }),
        body: JSON.stringify({ dni: "30123456", pin: "1234" }),
      })
    );
  });
});
