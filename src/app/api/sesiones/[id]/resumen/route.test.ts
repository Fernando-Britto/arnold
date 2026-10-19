/** @jest-environment node */
/**
 * GET /api/sesiones/[id]/resumen — T-046b, D-62. NextRequest/NextResponse reales.
 * `params` es una promesa (Next 16, FX-06). La capa API va mockeada para verificar la pertenencia.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/sesiones");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleObtenerSesion, handleResumenSesion, resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { GET } from "./route";

const mockResumen = handleResumenSesion as jest.MockedFunction<typeof handleResumenSesion>;
const mockObtener = handleObtenerSesion as jest.MockedFunction<typeof handleObtenerSesion>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const getReq = () => new NextRequest("http://localhost:3000/api/sesiones/s1/resumen");
const ctx = (id = "s1") => ({ params: Promise.resolve({ id }) });
const resumen = { sesionId: "s1", seriesHechas: 4, duracionMinutos: 45, ejercicios: [] };

describe("GET /api/sesiones/[id]/resumen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(401);
    expect(mockResumen).not.toHaveBeenCalled();
  });

  it("403 para un rol que no lee sesiones", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(403);
    expect(mockObtener).not.toHaveBeenCalled();
  });

  it("404 si la sesión no existe", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockObtener.mockResolvedValueOnce(null as never);
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(404);
    expect(mockResumen).not.toHaveBeenCalled();
  });

  it("403 si un SOCIO pide el resumen de la sesión de otro", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-2" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(403);
    expect(mockResumen).not.toHaveBeenCalled();
  });

  it("404 si el SOCIO no tiene fila de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce(null);

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(404);
    expect(mockResumen).not.toHaveBeenCalled();
  });

  it("200: un SOCIO lee el resumen de su propia sesión", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");
    mockResumen.mockResolvedValueOnce(resumen as never);

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(resumen);
    expect(mockResumen).toHaveBeenCalledWith("s1");
  });

  it.each(["ADMINISTRADOR", "INSTRUCTOR"])("200: %s lee el resumen de cualquier sesión", async (rol) => {
    mockUser.mockReturnValue({ id: "u-staff", rol });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-9" } as never);
    mockResumen.mockResolvedValueOnce(resumen as never);

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(200);
    expect(mockResumen).toHaveBeenCalledWith("s1");
  });

  it("mapea los errores del dominio", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResumen.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const res = await GET(getReq(), ctx());

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });
});
