/** @jest-environment node */
/**
 * POST /api/cierres (cerrar caja) y GET /api/cierres (listar o previsualizar) — T-040.
 * Se usa NextRequest/NextResponse reales (jest.unmock) para poder ejercitar el
 * chequeo de sesión y de rol, igual que /api/pagos.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/cierres");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import {
  handleCerrarCaja,
  handleListarCierres,
  handlePrevisualizarCierre,
} from "@/api/cierres";
import { extractUserFromRequest } from "@/lib/auth";
import {
  POST,
  GET,
  handleCerrarCajaRequest,
  handleListarCierresRequest,
  handlePrevisualizarCierreRequest,
} from "./route";

const mockCerrar = handleCerrarCaja as jest.MockedFunction<typeof handleCerrarCaja>;
const mockListar = handleListarCierres as jest.MockedFunction<typeof handleListarCierres>;
const mockPreview = handlePrevisualizarCierre as jest.MockedFunction<typeof handlePrevisualizarCierre>;
const mockUser = extractUserFromRequest as jest.Mock;

const cierreFalso = {
  id: "cierre-1",
  totalRecaudado: 1200,
  totalEfectivo: 1000,
  totalTransferencia: 0,
  totalTarjeta: 200,
  cantidadOperaciones: 2,
  pagos: [],
};

const postReq = (body?: unknown) =>
  new NextRequest("http://localhost:3000/api/cierres", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const getReq = (qs = "") => new NextRequest(`http://localhost:3000/api/cierres${qs}`);

describe("handleCerrarCajaRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 con el cierre creado", async () => {
    mockCerrar.mockResolvedValueOnce(cierreFalso as never);

    const r = await handleCerrarCajaRequest("u-rec");

    expect(r.status).toBe(201);
    expect(r.body).toEqual(cierreFalso);
  });

  it("400 si el usuario no tiene Empleado (VALIDATION_ERROR)", async () => {
    mockCerrar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: El usuario no tiene un empleado asociado"));

    const r = await handleCerrarCajaRequest("u-x");

    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("409 si el turno ya tiene un cierre (CASH_CLOSE_CONFLICT)", async () => {
    mockCerrar.mockRejectedValueOnce(
      new Error("CASH_CLOSE_CONFLICT: Ya existe un cierre de caja para el turno")
    );

    const r = await handleCerrarCajaRequest("u-rec");

    expect(r.status).toBe(409);
    expect((r.body as { code: string }).code).toBe("CASH_CLOSE_CONFLICT");
  });

  it("409 si Prisma detecta un fallo de serialización (P2034)", async () => {
    mockCerrar.mockRejectedValueOnce(
      Object.assign(new Error("write conflict"), { code: "P2034" })
    );

    const r = await handleCerrarCajaRequest("u-rec");

    expect(r.status).toBe(409);
    expect((r.body as { code: string }).code).toBe("CASH_CLOSE_CONFLICT");
  });
});

describe("handleListarCierresRequest / handlePrevisualizarCierreRequest", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con la lista de cierres", async () => {
    mockListar.mockResolvedValueOnce([cierreFalso] as never);
    const r = await handleListarCierresRequest();
    expect(r.status).toBe(200);
    expect(r.body).toEqual([cierreFalso]);
  });

  it("200 con la previsualización", async () => {
    mockPreview.mockResolvedValueOnce(cierreFalso as never);
    const r = await handlePrevisualizarCierreRequest();
    expect(r.status).toBe(200);
    expect(r.body).toEqual(cierreFalso);
  });
});

describe("POST /api/cierres", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
    expect(mockCerrar).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await POST(postReq());
    expect(res.status).toBe(403);
    expect(mockCerrar).not.toHaveBeenCalled();
  });

  it("201 para RECEPCIONISTA sin cuerpo (rango por defecto)", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockCerrar.mockResolvedValueOnce(cierreFalso as never);

    const res = await POST(postReq());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(cierreFalso);
    expect(mockCerrar).toHaveBeenCalledWith({ usuarioId: "u-rec", desde: undefined, hasta: undefined });
  });

  it("201 para ADMINISTRADOR con rango explícito", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCerrar.mockResolvedValueOnce(cierreFalso as never);

    const desde = "2026-10-11T03:00:00.000Z";
    const hasta = "2026-10-11T21:00:00.000Z";
    const res = await POST(postReq({ desde, hasta }));

    expect(res.status).toBe(201);
    expect(mockCerrar).toHaveBeenCalledWith({
      usuarioId: "u-admin",
      desde: new Date(desde),
      hasta: new Date(hasta),
    });
  });

  it("400 si el cuerpo no es JSON válido", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const req = new NextRequest("http://localhost:3000/api/cierres", {
      method: "POST",
      body: "{no-json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockCerrar).not.toHaveBeenCalled();
  });

  it("400 si una fecha del rango es inválida", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq({ desde: "no-es-fecha" }));
    expect(res.status).toBe(400);
    expect(mockCerrar).not.toHaveBeenCalled();
  });

  it("409 cuando ya existe un cierre para el turno", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockCerrar.mockRejectedValueOnce(
      new Error("CASH_CLOSE_CONFLICT: Ya existe un cierre de caja para el turno")
    );

    const res = await POST(postReq());

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CASH_CLOSE_CONFLICT");
  });
});

describe("GET /api/cierres", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("200 con la lista de cierres recientes", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockListar.mockResolvedValueOnce([cierreFalso] as never);

    const res = await GET(getReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([cierreFalso]);
    expect(mockListar).toHaveBeenCalled();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("200 con la previsualización si ?preview=1", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockPreview.mockResolvedValueOnce(cierreFalso as never);

    const res = await GET(getReq("?preview=1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(cierreFalso);
    expect(mockPreview).toHaveBeenCalled();
    expect(mockListar).not.toHaveBeenCalled();
  });
});
