/** @jest-environment node */
/**
 * POST /api/dispositivo/acceso (T-036): check-in de la puerta con autenticación de dispositivo
 * (sin sesión de usuario). Devuelve el mínimo: resultado + nombre + motivo (D-43).
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/acceso");
jest.mock("@/lib/dispositivo-auth", () => ({ autenticarDispositivo: jest.fn() }));

import { handleCheckIn } from "@/api/acceso";
import { autenticarDispositivo } from "@/lib/dispositivo-auth";
import { POST, aRespuestaPuerta } from "./route";

const mockAuth = autenticarDispositivo as jest.Mock;
const mockCheckIn = handleCheckIn as jest.MockedFunction<typeof handleCheckIn>;

const postReq = (body: unknown, headers: Record<string, string> = { "x-dispositivo-token": "tok" }) =>
  new NextRequest("http://localhost:3000/api/dispositivo/acceso", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });

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

const permitido = {
  resultado: "PERMITIDO" as const,
  socio: { id: "socio-1", nombre: "Ana García", membresia: "Gold" },
  estadoCuota: "AL_DIA" as const,
};

describe("aRespuestaPuerta", () => {
  it("devuelve SOLO resultado, nombre y motivo (sin plan ni estado de cuota)", () => {
    const r = aRespuestaPuerta(permitido);
    expect(r).toEqual({ resultado: "PERMITIDO", nombre: "Ana García" });
    expect(JSON.stringify(r)).not.toContain("Gold");
    expect(JSON.stringify(r)).not.toContain("AL_DIA");
  });

  it("incluye el motivo cuando hay denegación", () => {
    const r = aRespuestaPuerta({ resultado: "DENEGADO", motivo: "Cuota vencida" });
    expect(r).toEqual({ resultado: "DENEGADO", motivo: "Cuota vencida" });
    expect(r.nombre).toBeUndefined();
  });
});

describe("POST /api/dispositivo/acceso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin token de dispositivo válido (no llama al check-in)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));
    expect(res.status).toBe(401);
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it("400 si falta dni o pin", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    const res = await POST(postReq({ dni: "30123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it("200 con el mínimo (nombre + estado) y registra el check-in vía el servicio reutilizado", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockCheckIn.mockResolvedValueOnce(permitido);

    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ resultado: "PERMITIDO", nombre: "Ana García" });
    expect(body.membresia).toBeUndefined();
    expect(body.estadoCuota).toBeUndefined();
    expect(mockCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ dni: "30123456", pin: "1234" })
    );
  });

  it("429 cuando el servicio devuelve RATE_LIMITED", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockCheckIn.mockResolvedValueOnce({ resultado: "DENEGADO", motivo: "Demasiados intentos", code: "RATE_LIMITED" });

    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));

    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
  });

  it("mapea un error inesperado del check-in a 500 SERVER_ERROR (no un throw crudo) (AC-1)", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockCheckIn.mockRejectedValueOnce(new Error("boom"));

    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("SERVER_ERROR");
    expect(body.message).toBe("No se pudo procesar la solicitud");
    expect(JSON.stringify(body)).not.toContain("boom");
  });

  it("mapea un error de dominio (NOT_FOUND) al status correcto (AC-1)", async () => {
    mockAuth.mockResolvedValueOnce(dispositivo);
    mockCheckIn.mockRejectedValueOnce(
      Object.assign(new Error("NOT_FOUND: Socio no encontrado"), { code: "NOT_FOUND" })
    );

    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });
});
