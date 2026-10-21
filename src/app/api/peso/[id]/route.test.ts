/** @jest-environment node */
/**
 * DELETE /api/peso/[id] — el socio borra un pesaje propio (P-47, D-65).
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/peso");
jest.mock("@/api/sesiones");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleBorrarPeso } from "@/api/peso";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { DELETE } from "./route";

const mockBorrar = handleBorrarPeso as jest.MockedFunction<typeof handleBorrarPeso>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const req = () => new NextRequest("http://localhost:3000/api/peso/m1", { method: "DELETE" });
const params = (id = "m1") => ({ params: Promise.resolve({ id }) });

describe("DELETE /api/peso/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);

    expect((await DELETE(req(), params())).status).toBe(401);
    expect(mockBorrar).not.toHaveBeenCalled();
  });

  it.each(["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"])("403 para %s", async (rol) => {
    mockUser.mockReturnValue({ id: "u-staff", rol });

    expect((await DELETE(req(), params())).status).toBe(403);
    expect(mockBorrar).not.toHaveBeenCalled();
  });

  it("404 si el usuario socio no tiene perfil de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce(null);

    const res = await DELETE(req(), params());

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("SOCIO_NOT_FOUND");
  });

  it("204: borra el pesaje del propio socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockBorrar.mockResolvedValueOnce(undefined);

    const res = await DELETE(req(), params("m1"));

    expect(res.status).toBe(204);
    expect(mockBorrar).toHaveBeenCalledWith({ socioId: "socio-1", id: "m1" });
  });

  it("404 si el pesaje no es del socio (el dominio no distingue de inexistente)", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockBorrar.mockRejectedValueOnce(new Error("NOT_FOUND"));

    const res = await DELETE(req(), params("m-ajeno"));

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });
});
