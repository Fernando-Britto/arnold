/** @jest-environment node */
/**
 * PUT /api/sesiones/[id] (finalizar) — T-037. NextRequest/NextResponse reales.
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

import {
  handleFinalizarSesion,
  handleObtenerSesion,
  resolveSocioIdDeUsuario,
} from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { PUT } from "./route";

const mockFinalizar = handleFinalizarSesion as jest.MockedFunction<typeof handleFinalizarSesion>;
const mockObtener = handleObtenerSesion as jest.MockedFunction<typeof handleObtenerSesion>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const putReq = () =>
  new NextRequest("http://localhost:3000/api/sesiones/s1", { method: "PUT" });
const ctx = (id = "s1") => ({ params: Promise.resolve({ id }) });

describe("PUT /api/sesiones/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await PUT(putReq(), ctx());
    expect(res.status).toBe(401);
    expect(mockFinalizar).not.toHaveBeenCalled();
  });

  it("403 para INSTRUCTOR (solo lee)", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    const res = await PUT(putReq(), ctx());
    expect(res.status).toBe(403);
    expect(mockObtener).not.toHaveBeenCalled();
  });

  it("404 si la sesión no existe", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockObtener.mockResolvedValueOnce(null as never);
    const res = await PUT(putReq(), ctx());
    expect(res.status).toBe(404);
    expect(mockFinalizar).not.toHaveBeenCalled();
  });

  it("403 si un SOCIO intenta finalizar la sesión de otro", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-2" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await PUT(putReq(), ctx());

    expect(res.status).toBe(403);
    expect(mockFinalizar).not.toHaveBeenCalled();
  });

  it("404 si el SOCIO no tiene fila de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce(null);

    const res = await PUT(putReq(), ctx());

    expect(res.status).toBe(404);
    expect(mockFinalizar).not.toHaveBeenCalled();
  });

  it("200: un SOCIO finaliza su propia sesión", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");
    mockFinalizar.mockResolvedValueOnce({ id: "s1", estadoDeFinalizacion: "COMPLETADA" } as never);

    const res = await PUT(putReq(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "s1", estadoDeFinalizacion: "COMPLETADA" });
    expect(mockFinalizar).toHaveBeenCalledWith({ sesionId: "s1" });
  });

  it("200: un ADMINISTRADOR finaliza cualquier sesión", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-9" } as never);
    mockFinalizar.mockResolvedValueOnce({ id: "s1", estadoDeFinalizacion: "COMPLETADA" } as never);

    const res = await PUT(putReq(), ctx());

    expect(res.status).toBe(200);
    expect(mockFinalizar).toHaveBeenCalledWith({ sesionId: "s1" });
  });

  it("mapea los errores del dominio", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockFinalizar.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const res = await PUT(putReq(), ctx());

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });
});
