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

import { handleBuscarSocio, handleBuscarSociosPorNombre } from "@/api/socios";
import { extractUserFromRequest } from "@/lib/auth";
import { GET, handleBuscarSocioRequest, handleBuscarSociosRequest } from "./route";

const mockBuscar = handleBuscarSocio as jest.MockedFunction<typeof handleBuscarSocio>;
const mockBuscarVarios = handleBuscarSociosPorNombre as jest.MockedFunction<
  typeof handleBuscarSociosPorNombre
>;
const mockUser = extractUserFromRequest as jest.Mock;

const socioFalso = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: null,
  membresia: { id: "plan-gold", nombre: "Gold", precio: 30000 },
  estadoCuota: "PENDIENTE",
  fechaVencimiento: "2026-10-31T02:59:59.999Z",
  plan: {
    tipo: "RENOVACION",
    periodos: ["2026-11"],
    monto: 30000,
    cubreDesde: "2026-11-01T03:00:00.000Z",
    cubreHasta: "2026-11-30T02:59:59.999Z",
  },
};

const busquedaFalsa = {
  items: [
    {
      id: "socio-1",
      nombre: "Ana García",
      dni: "30123456",
      membresia: "Gold",
      fechaVencimiento: "2026-10-31T02:59:59.999Z",
      estadoCuota: "PENDIENTE",
    },
  ],
  total: 1,
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

describe("handleBuscarSociosRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con el resultado paginado", async () => {
    mockBuscarVarios.mockResolvedValueOnce(busquedaFalsa as never);

    const r = await handleBuscarSociosRequest("ana", 10, 0);

    expect(r.status).toBe(200);
    expect(r.body).toEqual(busquedaFalsa);
    expect(mockBuscarVarios).toHaveBeenCalledWith({ q: "ana", limit: 10, offset: 0 });
  });

  it("500 si la búsqueda falla", async () => {
    mockBuscarVarios.mockRejectedValueOnce(new Error("boom"));

    const r = await handleBuscarSociosRequest("ana");

    expect(r.status).toBe(500);
    expect((r.body as { code: string }).code).toBe("SERVER_ERROR");
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

  it("200 con la grilla paginada de ?q= para RECEPCIONISTA", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockBuscarVarios.mockResolvedValueOnce(busquedaFalsa as never);

    const res = await GET(getReq("?q=ana&limit=10&offset=0"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(busquedaFalsa);
    expect(mockBuscarVarios).toHaveBeenCalledWith({ q: "ana", limit: 10, offset: 0 });
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it("403 para INSTRUCTOR en la búsqueda por nombre", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });

    const res = await GET(getReq("?q=ana"));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
    expect(mockBuscarVarios).not.toHaveBeenCalled();
  });

  it("400 con limit inválido sin llamar al handler", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });

    const res = await GET(getReq("?q=ana&limit=0"));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockBuscarVarios).not.toHaveBeenCalled();
  });

  it("400 con offset inválido sin llamar al handler", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });

    const res = await GET(getReq("?q=ana&offset=-1"));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockBuscarVarios).not.toHaveBeenCalled();
  });

  it("400 si falta dni y q", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });

    const res = await GET(getReq("?limit=10"));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockBuscarVarios).not.toHaveBeenCalled();
  });
});
