/** @jest-environment node */
/**
 * POST /api/asignaciones/decidir (T-056f, CP4b).
 * NextRequest/NextResponse reales; el handler de la capa `api/` queda mockeado.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));
jest.mock("@/api/asignaciones", () => ({
  handleDecidirSugerencia: jest.fn(),
}));

import { extractUserFromRequest } from "@/lib/auth";
import { handleDecidirSugerencia } from "@/api/asignaciones";
import { POST } from "./route";

const mockUser = extractUserFromRequest as jest.Mock;
const mockHandler = handleDecidirSugerencia as jest.MockedFunction<typeof handleDecidirSugerencia>;

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/asignaciones/decidir", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const postRawReq = (raw: string) =>
  new NextRequest("http://localhost:3000/api/asignaciones/decidir", {
    method: "POST",
    body: raw,
    headers: { "content-type": "application/json" },
  });

const cuerpoOk = { accion: "ACEPTAR" as const, sugerencia: null, siguienteEnOrden: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockReturnValue({ id: "usuario-1", rol: "SOCIO" });
  mockHandler.mockResolvedValue({ status: 200, body: cuerpoOk });
});

describe("POST /api/asignaciones/decidir", () => {
  it("sin sesión devuelve 401", async () => {
    mockUser.mockReturnValue(null);

    const respuesta = await POST(postReq({ accion: "ACEPTAR" }));

    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "Token de autenticación inválido o faltante",
    });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("ADMIN, INSTRUCTOR y RECEPCIONISTA reciben 403", async () => {
    for (const rol of ["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"] as const) {
      mockUser.mockReturnValue({ id: "usuario-9", rol });
      const respuesta = await POST(postReq({ accion: "ACEPTAR" }));
      expect(respuesta.status).toBe(403);
      await expect(respuesta.json()).resolves.toEqual(
        expect.objectContaining({ code: "FORBIDDEN" })
      );
    }
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("un JSON malformado devuelve 400", async () => {
    const respuesta = await POST(postRawReq("{ accion: "));

    expect(respuesta.status).toBe(400);
    await expect(respuesta.json()).resolves.toEqual(
      expect.objectContaining({ code: "VALIDATION_ERROR" })
    );
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("SOCIO delega el body y el ahora del servidor", async () => {
    const respuesta = await POST(postReq({ accion: "ACEPTAR" }));

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual(cuerpoOk);
    expect(mockHandler).toHaveBeenCalledWith({
      actor: { usuarioId: "usuario-1", rol: "SOCIO" },
      body: { accion: "ACEPTAR" },
      ahora: expect.any(Date),
    });
  });

  it("el handler devuelve 400/403/404/409/500 tal cual", async () => {
    const casos = [
      { status: 400, body: { code: "VALIDATION_ERROR", message: "La solicitud no es válida" } },
      { status: 403, body: { code: "FORBIDDEN", message: "No tiene permiso para realizar esta acción" } },
      { status: 404, body: { code: "SIN_SUGERENCIA", message: "No hay una sugerencia vigente" } },
      {
        status: 409,
        body: {
          code: "SIN_SUGERENCIA_VIGENTE",
          message: "La sugerencia ya no está vigente; vuelva a consultar",
        },
      },
      { status: 500, body: { code: "SERVER_ERROR", message: "No se pudo procesar la solicitud" } },
    ] as const;

    for (const caso of casos) {
      mockHandler.mockResolvedValueOnce({ status: caso.status, body: caso.body });
      const respuesta = await POST(postReq({ accion: "ACEPTAR" }));
      expect(respuesta.status).toBe(caso.status);
      await expect(respuesta.json()).resolves.toEqual(caso.body);
    }
  });
});
