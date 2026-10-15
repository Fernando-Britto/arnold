/** @jest-environment node */
/**
 * PUT /api/dispositivos/[id] (AC-10): activa/desactiva un dispositivo, sólo ADMINISTRADOR,
 * con auditoría. NextRequest/NextResponse reales; el servicio va mockeado.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/dispositivos");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleDispositivoEstado } from "@/api/dispositivos";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { PUT } from "./route";

const mockEstado = handleDispositivoEstado as jest.MockedFunction<typeof handleDispositivoEstado>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const admin = { id: "u-admin", rol: "ADMINISTRADOR" };
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const putReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/dispositivos/dev-1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("PUT /api/dispositivos/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await PUT(putReq({ estado: "INACTIVO" }), params("dev-1"));
    expect(res.status).toBe(401);
    expect(mockEstado).not.toHaveBeenCalled();
  });

  it("403 para un rol no administrador", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await PUT(putReq({ estado: "INACTIVO" }), params("dev-1"));
    expect(res.status).toBe(403);
    expect(mockEstado).not.toHaveBeenCalled();
  });

  it("200 para ADMINISTRADOR y audita el cambio", async () => {
    mockUser.mockReturnValue(admin);
    mockEstado.mockResolvedValueOnce({
      id: "dev-1",
      nombre: "Puerta",
      tipo: "PUERTA",
      estado: "INACTIVO",
      ultimoContacto: null,
      createdAt: new Date(),
    });

    const res = await PUT(putReq({ estado: "INACTIVO" }), params("dev-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "dev-1", estado: "INACTIVO" });
    expect(mockEstado).toHaveBeenCalledWith("dev-1", "INACTIVO");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoOperacion: "MODIFICACION",
        responsableId: "u-admin",
        detalles: expect.objectContaining({ dispositivoId: "dev-1", estado: "INACTIVO" }),
      })
    );
  });

  it("404 mapeado cuando el dispositivo no existe (y no audita)", async () => {
    mockUser.mockReturnValue(admin);
    mockEstado.mockRejectedValueOnce(new Error("NOT_FOUND: Dispositivo no encontrado"));

    const res = await PUT(putReq({ estado: "INACTIVO" }), params("nope"));

    expect(res.status).toBe(404);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("400 si el cuerpo no es JSON", async () => {
    mockUser.mockReturnValue(admin);
    const bad = new NextRequest("http://localhost:3000/api/dispositivos/dev-1", {
      method: "PUT",
      body: "no-es-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(bad, params("dev-1"));
    expect(res.status).toBe(400);
    expect(mockEstado).not.toHaveBeenCalled();
  });
});
