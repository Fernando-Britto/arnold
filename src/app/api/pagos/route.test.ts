/** @jest-environment node */
/**
 * POST /api/pagos (registrar) y GET /api/pagos?socioId= (listar) — T-032.
 * Se usa NextRequest/NextResponse reales (jest.unmock) para poder ejercitar el
 * chequeo de sesión y de rol, igual que home-socio.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/pagos");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleRegistrarPago, handleListarPagos } from "@/api/pagos";
import { extractUserFromRequest } from "@/lib/auth";
import {
  POST,
  GET,
  handleRegistrarPagoRequest,
  handleListarPagosRequest,
} from "./route";

const mockRegistrar = handleRegistrarPago as jest.MockedFunction<typeof handleRegistrarPago>;
const mockListar = handleListarPagos as jest.MockedFunction<typeof handleListarPagos>;
const mockUser = extractUserFromRequest as jest.Mock;

const pagoFalso = {
  pago: { id: "pago-1", monto: 30000 },
  cuota: { id: "cuota-1" },
  plan: { tipo: "RENOVACION", periodos: ["2026-11"], monto: 30000 },
  estadoCuota: "AL_DIA",
};

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/pagos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const getReq = (qs = "") => new NextRequest(`http://localhost:3000/api/pagos${qs}`);

describe("handleRegistrarPagoRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 con el pago registrado", async () => {
    mockRegistrar.mockResolvedValueOnce(pagoFalso as never);

    const r = await handleRegistrarPagoRequest({ socioId: "socio-1", metodoPago: "EFECTIVO" });

    expect(r.status).toBe(201);
    expect(r.body).toEqual(pagoFalso);
  });

  it("404 si el socio no existe", async () => {
    mockRegistrar.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const r = await handleRegistrarPagoRequest({ socioId: "nope", metodoPago: "EFECTIVO" });

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
  });

  it("400 si el input es inválido", async () => {
    mockRegistrar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: Método de pago inválido"));

    const r = await handleRegistrarPagoRequest({ socioId: "socio-1", metodoPago: "BITCOIN" });

    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("409 si el pago ya fue registrado para el período (PG-4)", async () => {
    mockRegistrar.mockRejectedValueOnce(
      new Error("PAYMENT_ALREADY_REGISTERED: Ya existe una cuota para el período que se intenta pagar")
    );

    const r = await handleRegistrarPagoRequest({ socioId: "socio-1", metodoPago: "EFECTIVO" });

    expect(r.status).toBe(409);
    expect((r.body as { code: string }).code).toBe("PAYMENT_ALREADY_REGISTERED");
  });
});

describe("handleListarPagosRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con la lista de pagos del socio", async () => {
    const lista = [{ id: "pago-1", monto: 30000 }];
    mockListar.mockResolvedValueOnce(lista as never);

    const r = await handleListarPagosRequest("socio-1");

    expect(r.status).toBe(200);
    expect(r.body).toEqual(lista);
    expect(mockListar).toHaveBeenCalledWith("socio-1");
  });
});

describe("POST /api/pagos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ socioId: "socio-1", metodoPago: "EFECTIVO" }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await POST(postReq({ socioId: "socio-1", metodoPago: "EFECTIVO" }));
    expect(res.status).toBe(403);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("400 con body null (no 500) — PG-3", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq(null));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("400 si falta socioId (no 500) — PG-3", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq({ metodoPago: "EFECTIVO" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("400 si el body no es un objeto JSON — PG-3", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq("no-soy-un-objeto"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("201 para RECEPCIONISTA con un pago válido", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockRegistrar.mockResolvedValueOnce(pagoFalso as never);

    const res = await POST(postReq({ socioId: "socio-1", metodoPago: "EFECTIVO" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(pagoFalso);
    expect(mockRegistrar).toHaveBeenCalledWith({ socioId: "socio-1", metodoPago: "EFECTIVO" });
  });
});

describe("GET /api/pagos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq("?socioId=socio-1"));
    expect(res.status).toBe(401);
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await GET(getReq("?socioId=socio-1"));
    expect(res.status).toBe(403);
  });

  it("400 si falta socioId", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await GET(getReq());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("200 con los pagos del socio pedido", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockListar.mockResolvedValueOnce([] as never);

    const res = await GET(getReq("?socioId=socio-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockListar).toHaveBeenCalledWith("socio-1");
  });
});
