/** @jest-environment node */
/**
 * /api/dispositivos (T-036): alta (solo ADMINISTRADOR) que devuelve el token en claro una vez,
 * y listado sin token. NextRequest/NextResponse reales.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/dispositivos");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleDispositivoCreate, handleDispositivoList } from "@/api/dispositivos";
import { extractUserFromRequest } from "@/lib/auth";
import { POST, GET, handleDispositivoCreateRequest } from "./route";

const mockCreate = handleDispositivoCreate as jest.MockedFunction<typeof handleDispositivoCreate>;
const mockList = handleDispositivoList as jest.MockedFunction<typeof handleDispositivoList>;
const mockUser = extractUserFromRequest as jest.Mock;

const admin = { id: "u-admin", rol: "ADMINISTRADOR" };
const jsonReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/dispositivos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const getReq = () => new NextRequest("http://localhost:3000/api/dispositivos", { method: "GET" });

describe("handleDispositivoCreateRequest", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 con el dispositivo y el token en claro", async () => {
    mockCreate.mockResolvedValueOnce({
      dispositivo: { id: "dev-1", nombre: "Puerta", tipo: "PUERTA", estado: "ACTIVO", ultimoContacto: null, createdAt: new Date() },
      token: "tok-en-claro",
    });

    const r = await handleDispositivoCreateRequest({ nombre: "Puerta" });

    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ token: "tok-en-claro" });
  });

  it("400 VALIDATION_ERROR mapeado por el servicio", async () => {
    mockCreate.mockRejectedValueOnce(new Error("VALIDATION_ERROR: El nombre del dispositivo es obligatorio"));
    const r = await handleDispositivoCreateRequest({ nombre: "" });
    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/dispositivos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(jsonReq({ nombre: "Puerta" }));
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("403 para un rol no administrador (RECEPCIONISTA)", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(jsonReq({ nombre: "Puerta" }));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("201 para ADMINISTRADOR", async () => {
    mockUser.mockReturnValue(admin);
    mockCreate.mockResolvedValueOnce({
      dispositivo: { id: "dev-1", nombre: "Puerta", tipo: "PUERTA", estado: "ACTIVO", ultimoContacto: null, createdAt: new Date() },
      token: "tok-en-claro",
    });

    const res = await POST(jsonReq({ nombre: "Puerta" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ token: "tok-en-claro" });
  });

  it("400 si el cuerpo no es JSON", async () => {
    mockUser.mockReturnValue(admin);
    const bad = new NextRequest("http://localhost:3000/api/dispositivos", {
      method: "POST",
      body: "no-es-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/dispositivos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("403 para un rol no administrador", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await GET(getReq());
    expect(res.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("200 con la lista para ADMINISTRADOR", async () => {
    mockUser.mockReturnValue(admin);
    mockList.mockResolvedValueOnce([
      { id: "dev-1", nombre: "Puerta", tipo: "PUERTA", estado: "ACTIVO", ultimoContacto: null, createdAt: new Date() },
    ] as never);

    const res = await GET(getReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });
});
