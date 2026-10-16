/** @jest-environment node */
/**
 * GET /api/dispositivo/huellas/pendiente (T-041): cola de solicitudes que el sensor consulta.
 * Autenticación por token de dispositivo, sin sesión de usuario.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/huellas");
jest.mock("@/lib/dispositivo-auth", () => ({ autenticarDispositivo: jest.fn() }));

import { tomarSolicitudPendiente } from "@/api/huellas";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { GET } from "./route";

const mockAuth = autenticarDispositivo as jest.Mock;
const mockPendiente = tomarSolicitudPendiente as jest.MockedFunction<typeof tomarSolicitudPendiente>;

const dispositivo = {
  id: "dev-1",
  nombre: "Puerta",
  tipo: "PUERTA",
  estado: "ACTIVO",
  tokenHash: "hash",
  ultimoContacto: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const req = () =>
  new NextRequest("http://localhost:3000/api/dispositivo/huellas/pendiente", {
    method: "GET",
    headers: { "x-dispositivo-token": "tok" },
  });

describe("GET /api/dispositivo/huellas/pendiente", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 sin token de dispositivo", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(mockPendiente).not.toHaveBeenCalled();
  });

  it("200 con una solicitud pendiente", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockPendiente.mockResolvedValueOnce({ accion: "enrolar", huellaId: 5 });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accion: "enrolar", huellaId: 5 });
  });

  it("200 con accion null cuando no hay pendientes", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockPendiente.mockResolvedValueOnce({ accion: null });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accion: null });
  });

  it("mapea un error inesperado a 500 SERVER_ERROR", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockPendiente.mockRejectedValueOnce(new Error("boom"));

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SERVER_ERROR");
  });
});
