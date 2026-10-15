/** @jest-environment node */
/**
 * GET /api/socios?dni= — búsqueda de socio para "Registrar Pago" (T-033).
 * NextRequest/NextResponse reales (jest.unmock) para ejercitar sesión y rol,
 * igual que /api/pagos.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/socios");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleBuscarSocio } from "@/api/socios";
import { extractUserFromRequest } from "@/lib/auth";
import { GET, handleBuscarSocioRequest } from "./route";

const mockBuscar = handleBuscarSocio as jest.MockedFunction<typeof handleBuscarSocio>;
const mockUser = extractUserFromRequest as jest.Mock;

const socioFalso = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: null,
  membresia: { id: "plan-gold", nombre: "Gold", precio: 30000 },
  estadoCuota: "PENDIENTE",
  plan: {
    tipo: "RENOVACION",
    periodos: ["2026-11"],
    monto: 30000,
    cubreDesde: "2026-11-01T03:00:00.000Z",
    cubreHasta: "2026-11-30T02:59:59.999Z",
  },
};

const getReq = (qs = "") => new NextRequest(`http://localhost:3000/api/socios${qs}`);

describe("handleBuscarSocioRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con el socio encontrado", async () => {
    mockBuscar.mockResolvedValueOnce(socioFalso as never);

    const r = await handleBuscarSocioRequest("30123456");

    expect(r.status).toBe(200);
    expect(r.body).toEqual(socioFalso);
    expect(mockBuscar).toHaveBeenCalledWith("30123456");
  });

  it("404 si el DNI no existe", async () => {
    mockBuscar.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const r = await handleBuscarSocioRequest("00000000");

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
  });
});

describe("GET /api/socios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq("?dni=30123456"));
    expect(res.status).toBe(401);
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (SOCIO)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    const res = await GET(getReq("?dni=30123456"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it("200 para INSTRUCTOR: busca el socio para asignarle una rutina (N1)", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    mockBuscar.mockResolvedValueOnce(socioFalso as never);

    const res = await GET(getReq("?dni=30123456"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(socioFalso);
    expect(mockBuscar).toHaveBeenCalledWith("30123456");
  });

  it("400 si falta el parámetro dni", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await GET(getReq());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it("200 con el socio pedido para RECEPCIONISTA", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockBuscar.mockResolvedValueOnce(socioFalso as never);

    const res = await GET(getReq("?dni=30123456"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(socioFalso);
    expect(mockBuscar).toHaveBeenCalledWith("30123456");
  });
});
