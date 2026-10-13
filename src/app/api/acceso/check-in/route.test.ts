/** @jest-environment node */
/**
 * POST /api/acceso/check-in (T-035): ingreso por DNI + PIN desde recepción.
 * NextRequest/NextResponse reales para ejercitar sesión, rol y el 429 del rate limit.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/acceso");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleCheckIn } from "@/api/acceso";
import { extractUserFromRequest } from "@/lib/auth";
import { POST, handleCheckInRequest } from "./route";

const mockCheckIn = handleCheckIn as jest.MockedFunction<typeof handleCheckIn>;
const mockUser = extractUserFromRequest as jest.Mock;

const permitido = {
  resultado: "PERMITIDO" as const,
  socio: { nombre: "Ana García", membresia: "Gold" },
  estadoCuota: "AL_DIA" as const,
};

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/acceso/check-in", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("handleCheckInRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con el resultado del check-in", async () => {
    mockCheckIn.mockResolvedValueOnce(permitido);

    const r = await handleCheckInRequest({ dni: "30123456", pin: "1234" });

    expect(r.status).toBe(200);
    expect(r.body).toEqual(permitido);
  });

  it("429 cuando el servicio devuelve RATE_LIMITED", async () => {
    mockCheckIn.mockResolvedValueOnce({
      resultado: "DENEGADO",
      motivo: "Demasiados intentos. Probá de nuevo en un minuto.",
      code: "RATE_LIMITED",
    });

    const r = await handleCheckInRequest({ dni: "30123456", pin: "1234" });

    expect(r.status).toBe(429);
    expect((r.body as { code: string }).code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/acceso/check-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));
    expect(res.status).toBe(401);
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));
    expect(res.status).toBe(403);
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it("400 si falta dni o pin", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq({ dni: "30123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it("400 si el cuerpo no es JSON", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const bad = new NextRequest("http://localhost:3000/api/acceso/check-in", {
      method: "POST",
      body: "no-es-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it("200 para RECEPCIONISTA con DNI y PIN", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockCheckIn.mockResolvedValueOnce(permitido);

    const res = await POST(postReq({ dni: "30123456", pin: "1234" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(permitido);
    expect(mockCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ dni: "30123456", pin: "1234" })
    );
  });
});
