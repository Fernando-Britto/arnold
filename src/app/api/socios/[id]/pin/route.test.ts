/** @jest-environment node */
/**
 * POST /api/socios/{id}/pin (T-035): definir el PIN de 4 dígitos de un socio.
 * NextRequest/NextResponse reales para ejercitar sesión y rol, igual que /api/pagos.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/acceso");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleSetPin } from "@/api/acceso";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { POST, handleSetPinRequest } from "./route";

const mockSetPin = handleSetPin as jest.MockedFunction<typeof handleSetPin>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const params = { params: Promise.resolve({ id: "socio-1" }) };
const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/socios/socio-1/pin", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("handleSetPinRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 al definir el PIN", async () => {
    mockSetPin.mockResolvedValueOnce({ success: true });

    const r = await handleSetPinRequest("socio-1", { pin: "1234" });

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
    expect(mockSetPin).toHaveBeenCalledWith("socio-1", "1234");
  });

  it("400 si el PIN no son 4 dígitos", async () => {
    mockSetPin.mockRejectedValueOnce(new Error("VALIDATION_ERROR: El PIN debe tener exactamente 4 dígitos"));

    const r = await handleSetPinRequest("socio-1", { pin: "12" });

    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("404 si el socio no existe", async () => {
    mockSetPin.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const r = await handleSetPinRequest("nope", { pin: "1234" });

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
  });
});

describe("POST /api/socios/{id}/pin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ pin: "1234" }), params);
    expect(res.status).toBe(401);
    expect(mockSetPin).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await POST(postReq({ pin: "1234" }), params);
    expect(res.status).toBe(403);
    expect(mockSetPin).not.toHaveBeenCalled();
  });

  it("400 si el cuerpo no es JSON", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const bad = new NextRequest("http://localhost:3000/api/socios/socio-1/pin", {
      method: "POST",
      body: "no-es-json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(bad, params);

    expect(res.status).toBe(400);
    expect(mockSetPin).not.toHaveBeenCalled();
  });

  it("200 para RECEPCIONISTA con un PIN válido", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockSetPin.mockResolvedValueOnce({ success: true });

    const res = await POST(postReq({ pin: "4821" }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockSetPin).toHaveBeenCalledWith("socio-1", "4821");
  });
});

describe("POST /api/socios/{id}/pin — auditoría del re-set (P-33)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra MODIFICACION con el responsable y el socio, sin filtrar el PIN", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockSetPin.mockResolvedValueOnce({ success: true });

    const res = await POST(postReq({ pin: "4821" }), params);

    expect(res.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "MODIFICACION",
      responsableId: "u-rec",
      detalles: { socioId: "socio-1", campo: "pin" },
    });
    expect(JSON.stringify(mockAudit.mock.calls)).not.toContain("4821");
  });

  it("no registra auditoría si el set de PIN falla", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockSetPin.mockRejectedValueOnce(new Error("VALIDATION_ERROR: El PIN debe tener exactamente 4 dígitos"));

    const res = await POST(postReq({ pin: "12" }), params);

    expect(res.status).toBe(400);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("no registra auditoría sin sesión", async () => {
    mockUser.mockReturnValue(null);

    const res = await POST(postReq({ pin: "1234" }), params);

    expect(res.status).toBe(401);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("no registra auditoría con un rol no autorizado", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });

    const res = await POST(postReq({ pin: "1234" }), params);

    expect(res.status).toBe(403);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
