/** @jest-environment node */
/**
 * GET /api/asignaciones/sugerencia (T-056f, CP4b).
 * NextRequest/NextResponse reales; el handler de la capa `api/` queda mockeado.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));
jest.mock("@/api/asignaciones", () => ({
  handleObtenerSugerencia: jest.fn(),
}));

import { extractUserFromRequest } from "@/lib/auth";
import { handleObtenerSugerencia } from "@/api/asignaciones";
import { GET } from "./route";

const mockUser = extractUserFromRequest as jest.Mock;
const mockHandler = handleObtenerSugerencia as jest.MockedFunction<typeof handleObtenerSugerencia>;

const getReq = (query = "") =>
  new NextRequest(`http://localhost:3000/api/asignaciones/sugerencia${query}`);

const cuerpoOk = {
  socioId: "socio-1",
  sugerencia: null,
  siguienteEnOrden: null,
  calculadoEn: "2026-10-25T10:05:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockReturnValue({ id: "usuario-1", rol: "SOCIO" });
  mockHandler.mockResolvedValue({ status: 200, body: cuerpoOk });
});

describe("GET /api/asignaciones/sugerencia", () => {
  it("sin sesión devuelve 401", async () => {
    mockUser.mockReturnValue(null);

    const respuesta = await GET(getReq());

    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "Token de autenticación inválido o faltante",
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("RECEPCIONISTA recibe 403", async () => {
    mockUser.mockReturnValue({ id: "usuario-3", rol: "RECEPCIONISTA" });

    const respuesta = await GET(getReq());

    expect(respuesta.status).toBe(403);
    await expect(respuesta.json()).resolves.toEqual(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("SOCIO delega con su usuario y el ahora del servidor", async () => {
    const respuesta = await GET(getReq());

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual(cuerpoOk);
    expect(mockHandler).toHaveBeenCalledWith({
      actor: { usuarioId: "usuario-1", rol: "SOCIO" },
      socioIdQuery: null,
      ahora: expect.any(Date),
    });
  });

  it("ADMIN delega con el socioId de la query", async () => {
    mockUser.mockReturnValue({ id: "usuario-9", rol: "ADMINISTRADOR" });

    await GET(getReq("?socioId=socio-2"));

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({ socioIdQuery: "socio-2" })
    );
  });

  it("una query sin socioId llega como null", async () => {
    mockUser.mockReturnValue({ id: "usuario-8", rol: "INSTRUCTOR" });

    await GET(getReq("?otro=1"));

    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({ socioIdQuery: null }));
  });

  it("un handler que devuelve 404/409/500 se propaga tal cual", async () => {
    mockHandler.mockResolvedValue({
      status: 404,
      body: { code: "NOT_FOUND", message: "Socio no encontrado" },
    });

    const respuesta = await GET(getReq());

    expect(respuesta.status).toBe(404);
    await expect(respuesta.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Socio no encontrado",
    });
  });
});
