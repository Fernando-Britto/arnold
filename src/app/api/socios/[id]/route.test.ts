/** @jest-environment node */
/**
 * GET /api/socios/[id] — vista previa de cobro por id para "Registrar Pago".
 * NextRequest/NextResponse reales (jest.unmock) para ejercitar sesión y rol.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/socios");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleBuscarSocioPorId } from "@/api/socios";
import { extractUserFromRequest } from "@/lib/auth";
import { GET, handleBuscarSocioPorIdRequest } from "./route";

const mockBuscar = handleBuscarSocioPorId as jest.MockedFunction<typeof handleBuscarSocioPorId>;
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
  oferta: null,
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const getReq = () => new NextRequest("http://localhost:3000/api/socios/socio-1");

describe("handleBuscarSocioPorIdRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con el socio", async () => {
    mockBuscar.mockResolvedValueOnce(socioFalso as never);

    const r = await handleBuscarSocioPorIdRequest("socio-1");

    expect(r.status).toBe(200);
    expect(r.body).toEqual(socioFalso);
    expect(mockBuscar).toHaveBeenCalledWith("socio-1");
  });

  it("404 si el socio no existe", async () => {
    mockBuscar.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const r = await handleBuscarSocioPorIdRequest("no-existe");

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
  });
});

describe("GET /api/socios/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);

    const res = await GET(getReq(), params("socio-1"));

    expect(res.status).toBe(401);
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it("403 para un rol no autorizado (SOCIO)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });

    const res = await GET(getReq(), params("socio-1"));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
    expect(mockBuscar).not.toHaveBeenCalled();
  });

  it("404 si el id no existe", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    mockBuscar.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const res = await GET(getReq(), params("no-existe"));

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("200 con el socio para INSTRUCTOR", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    mockBuscar.mockResolvedValueOnce(socioFalso as never);

    const res = await GET(getReq(), params("socio-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(socioFalso);
    expect(mockBuscar).toHaveBeenCalledWith("socio-1");
  });
});
