/** @jest-environment node */
/**
 * POST /api/dispositivo/acceso/verificar (T-041): acceso por huella. El sensor manda huellaId y
 * confianza; el dispositivo se autentica por token, sin sesión de usuario (D-47).
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/huellas");
jest.mock("@/lib/dispositivo-auth", () => ({ autenticarDispositivo: jest.fn() }));

import { handleAccesoPorHuella } from "@/api/huellas";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { POST } from "./route";

const mockAuth = autenticarDispositivo as jest.Mock;
const mockAcceso = handleAccesoPorHuella as jest.MockedFunction<typeof handleAccesoPorHuella>;

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

const req = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/dispositivo/acceso/verificar", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-dispositivo-token": "tok",
      "user-agent": "sensor-huella",
    },
  });

describe("POST /api/dispositivo/acceso/verificar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 sin token de dispositivo", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(req({ huellaId: 4, confianza: 80 }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(mockAcceso).not.toHaveBeenCalled();
  });

  it("400 si faltan huellaId o confianza", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    const res = await POST(req({ huellaId: 4 }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockAcceso).not.toHaveBeenCalled();
  });

  it("200 con la decisión y pasa ip/user-agent del dispositivo", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockAcceso.mockResolvedValueOnce({ autorizado: true, nombre: "Ana García" });

    const res = await POST(req({ huellaId: 4, confianza: 80 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ autorizado: true, nombre: "Ana García" });
    expect(mockAcceso).toHaveBeenCalledWith(
      expect.objectContaining({ huellaId: 4, confianza: 80, userAgent: "sensor-huella" })
    );
  });

  it("200 con autorizado false y motivo (huella no reconocida)", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockAcceso.mockResolvedValueOnce({ autorizado: false, motivo: "Huella no reconocida" });

    const res = await POST(req({ huellaId: 999, confianza: 90 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ autorizado: false, motivo: "Huella no reconocida" });
  });

  it("mapea un error inesperado a 500 SERVER_ERROR", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockAcceso.mockRejectedValueOnce(new Error("boom"));

    const res = await POST(req({ huellaId: 4, confianza: 80 }));

    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SERVER_ERROR");
  });
});
