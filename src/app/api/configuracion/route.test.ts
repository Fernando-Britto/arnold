/** @jest-environment node */
/**
 * GET /api/configuracion y PUT /api/configuracion (T-043b, D-54).
 * Se usan NextRequest/NextResponse reales (jest.unmock) para ejercitar sesión y rol,
 * igual que pagos. La validación del dominio corre de verdad; Prisma queda mockeado.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/lib/configuracion", () => ({
  getConfiguracion: jest.fn(),
  actualizarConfiguracion: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { getConfiguracion, actualizarConfiguracion } from "@/lib/configuracion";
import { extractUserFromRequest } from "@/lib/auth";
import {
  GET,
  PUT,
  handleObtenerConfiguracionRequest,
  handleActualizarConfiguracionRequest,
} from "./route";

const mockObtener = getConfiguracion as jest.MockedFunction<typeof getConfiguracion>;
const mockActualizar = actualizarConfiguracion as jest.MockedFunction<typeof actualizarConfiguracion>;
const mockUser = extractUserFromRequest as jest.Mock;

const configFalsa = {
  capacidadMaxima: 100,
  periodoGracia: 0,
  diasInactividad: 15,
  descuentoReactivacion: 0,
  ofertaReactivacionActiva: false,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
};

const getReq = () => new NextRequest("http://localhost:3000/api/configuracion");
const putReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/configuracion", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const putRawReq = (raw: string) =>
  new NextRequest("http://localhost:3000/api/configuracion", {
    method: "PUT",
    body: raw,
    headers: { "content-type": "application/json" },
  });

describe("handleObtenerConfiguracionRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con la configuración completa", async () => {
    mockObtener.mockResolvedValueOnce(configFalsa);

    const r = await handleObtenerConfiguracionRequest();

    expect(r.status).toBe(200);
    expect(r.body).toEqual(configFalsa);
  });
});

describe("handleActualizarConfiguracionRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 con mensaje y sin tocar la base cuando un valor está fuera de rango", async () => {
    const r = await handleActualizarConfiguracionRequest({ descuentoReactivacion: 80 }, "admin-1");

    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
    expect((r.body as { message: string }).message).toContain("entre 1 y 50");
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  it("200 con la configuración resultante y el responsable", async () => {
    mockActualizar.mockResolvedValueOnce({ ...configFalsa, capacidadMaxima: 150 });

    const r = await handleActualizarConfiguracionRequest({ capacidadMaxima: 150 }, "admin-1");

    expect(r.status).toBe(200);
    expect((r.body as { capacidadMaxima: number }).capacidadMaxima).toBe(150);
    expect(mockActualizar).toHaveBeenCalledWith({ capacidadMaxima: 150 }, "admin-1");
  });
});

describe("GET /api/configuracion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
    expect(mockObtener).not.toHaveBeenCalled();
  });

  it("403 para SOCIO, INSTRUCTOR y RECEPCIONISTA", async () => {
    for (const rol of ["SOCIO", "INSTRUCTOR", "RECEPCIONISTA"]) {
      mockUser.mockReturnValue({ id: "u1", rol });
      const res = await GET(getReq());
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("FORBIDDEN");
    }
    expect(mockObtener).not.toHaveBeenCalled();
  });

  it("200 para ADMINISTRADOR", async () => {
    mockUser.mockReturnValue({ id: "admin-1", rol: "ADMINISTRADOR" });
    mockObtener.mockResolvedValueOnce(configFalsa);

    const res = await GET(getReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(configFalsa);
  });
});

describe("PUT /api/configuracion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("403 para RECEPCIONISTA", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await PUT(putReq({ capacidadMaxima: 150 }));
    expect(res.status).toBe(403);
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  it("400 con mensaje y sin actualizar cuando un valor está fuera de rango", async () => {
    mockUser.mockReturnValue({ id: "admin-1", rol: "ADMINISTRADOR" });

    const res = await PUT(putReq({ descuentoReactivacion: 80 }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message).toContain("entre 1 y 50");
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  it("200 para ADMINISTRADOR con un valor válido", async () => {
    mockUser.mockReturnValue({ id: "admin-1", rol: "ADMINISTRADOR" });
    mockActualizar.mockResolvedValueOnce({ ...configFalsa, capacidadMaxima: 150 });

    const res = await PUT(putReq({ capacidadMaxima: 150 }));

    expect(res.status).toBe(200);
    expect((await res.json()).capacidadMaxima).toBe(150);
    expect(mockActualizar).toHaveBeenCalledWith({ capacidadMaxima: 150 }, "admin-1");
  });

  it("400 si el cuerpo no es JSON válido", async () => {
    mockUser.mockReturnValue({ id: "admin-1", rol: "ADMINISTRADOR" });

    const res = await PUT(putRawReq("{no-es-json"));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockActualizar).not.toHaveBeenCalled();
  });
});
