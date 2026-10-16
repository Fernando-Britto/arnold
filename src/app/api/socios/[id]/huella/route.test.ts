/** @jest-environment node */
/**
 * POST/GET /api/socios/{id}/huella (T-041): registrar o borrar la huella de un socio.
 * NextRequest/NextResponse reales para ejercitar sesión y rol, igual que /pin.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/huellas");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { estadoHuella, solicitarBaja, solicitarEnrolamiento } from "@/api/huellas";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { GET, POST, handleHuellaGetRequest, handleHuellaPostRequest } from "./route";

const mockEnrolar = solicitarEnrolamiento as jest.MockedFunction<typeof solicitarEnrolamiento>;
const mockBaja = solicitarBaja as jest.MockedFunction<typeof solicitarBaja>;
const mockEstado = estadoHuella as jest.MockedFunction<typeof estadoHuella>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const params = { params: Promise.resolve({ id: "socio-1" }) };
const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/socios/socio-1/huella", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const getReq = () =>
  new NextRequest("http://localhost:3000/api/socios/socio-1/huella", { method: "GET" });

const solicitud = {
  id: "sol-1",
  accion: "ENROLAR" as const,
  huellaId: 3,
  estado: "PENDIENTE" as const,
  motivo: null,
  duplicadoDe: null,
  createdAt: new Date(),
  resueltaEn: null,
};

describe("handleHuellaPostRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 al encolar un enrolamiento con consentimiento", async () => {
    mockEnrolar.mockResolvedValueOnce(solicitud);

    const r = await handleHuellaPostRequest("socio-1", { accion: "enrolar", consentimiento: true });

    expect(r.status).toBe(200);
    expect(r.body).toEqual(solicitud);
    expect(mockEnrolar).toHaveBeenCalledWith("socio-1", { consentimiento: true });
  });

  it("200 al encolar una baja", async () => {
    mockBaja.mockResolvedValueOnce({ ...solicitud, accion: "BORRAR" });

    const r = await handleHuellaPostRequest("socio-1", { accion: "borrar" });

    expect(r.status).toBe(200);
    expect(mockBaja).toHaveBeenCalledWith("socio-1");
  });

  it("400 con una acción inválida (no llama al servicio)", async () => {
    const r = await handleHuellaPostRequest("socio-1", { accion: "otra" });

    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
    expect(mockEnrolar).not.toHaveBeenCalled();
    expect(mockBaja).not.toHaveBeenCalled();
  });

  it("400 si falta el consentimiento", async () => {
    mockEnrolar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: Se requiere consentimiento informado"));

    const r = await handleHuellaPostRequest("socio-1", { accion: "enrolar" });

    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("404 si el socio no existe", async () => {
    mockEnrolar.mockRejectedValueOnce(new Error("NOT_FOUND: Socio no encontrado"));

    const r = await handleHuellaPostRequest("nope", { accion: "enrolar", consentimiento: true });

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
  });
});

describe("handleHuellaGetRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con el estado de la huella", async () => {
    const estado = { huellaId: 3, consentimientoEn: new Date(), solicitud };
    mockEstado.mockResolvedValueOnce(estado);

    const r = await handleHuellaGetRequest("socio-1");

    expect(r.status).toBe(200);
    expect(r.body).toEqual(estado);
  });

  it("404 si el socio no existe", async () => {
    mockEstado.mockRejectedValueOnce(new Error("NOT_FOUND: Socio no encontrado"));

    const r = await handleHuellaGetRequest("nope");

    expect(r.status).toBe(404);
  });
});

describe("POST /api/socios/{id}/huella", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ accion: "enrolar", consentimiento: true }), params);
    expect(res.status).toBe(401);
    expect(mockEnrolar).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await POST(postReq({ accion: "enrolar", consentimiento: true }), params);
    expect(res.status).toBe(403);
    expect(mockEnrolar).not.toHaveBeenCalled();
  });

  it("400 si el cuerpo no es JSON", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const bad = new NextRequest("http://localhost:3000/api/socios/socio-1/huella", {
      method: "POST",
      body: "no-es-json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(bad, params);

    expect(res.status).toBe(400);
    expect(mockEnrolar).not.toHaveBeenCalled();
  });

  it("200 para RECEPCIONISTA y audita la modificación sin filtrar plantillas", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockEnrolar.mockResolvedValueOnce(solicitud);

    const res = await POST(postReq({ accion: "enrolar", consentimiento: true }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(solicitud)));
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "MODIFICACION",
      responsableId: "u-rec",
      detalles: { socioId: "socio-1", campo: "huella" },
    });
  });

  it("no registra auditoría si la acción falla", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockEnrolar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: Se requiere consentimiento informado"));

    const res = await POST(postReq({ accion: "enrolar" }), params);

    expect(res.status).toBe(400);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

describe("GET /api/socios/{id}/huella", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq(), params);
    expect(res.status).toBe(401);
    expect(mockEstado).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await GET(getReq(), params);
    expect(res.status).toBe(403);
    expect(mockEstado).not.toHaveBeenCalled();
  });

  it("200 con el estado para RECEPCIONISTA", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const estado = { huellaId: null, consentimientoEn: null, solicitud: null };
    mockEstado.mockResolvedValueOnce(estado);

    const res = await GET(getReq(), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(estado);
    expect(mockEstado).toHaveBeenCalledWith("socio-1");
  });
});
