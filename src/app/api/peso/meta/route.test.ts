/** @jest-environment node */
/**
 * PUT /api/peso/meta — el socio fija o borra su meta de peso (T-048, D-65).
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

import { handleFijarMeta } from "@/api/peso";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { PUT } from "./route";

const mockFijar = handleFijarMeta as jest.MockedFunction<typeof handleFijarMeta>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const putReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/peso/meta", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("PUT /api/peso/meta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);

    expect((await PUT(putReq({ pesoObjetivo: 77 }))).status).toBe(401);
    expect(mockFijar).not.toHaveBeenCalled();
  });

  it.each(["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"])("403 para %s", async (rol) => {
    mockUser.mockReturnValue({ id: "u-staff", rol });

    expect((await PUT(putReq({ pesoObjetivo: 77 }))).status).toBe(403);
    expect(mockFijar).not.toHaveBeenCalled();
  });

  it("404 si el usuario socio no tiene perfil de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce(null);

    const res = await PUT(putReq({ pesoObjetivo: 77 }));

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("SOCIO_NOT_FOUND");
  });

  it("400 con un cuerpo que no es JSON", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await PUT(putReq("{no es json"));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("400 si falta pesoObjetivo: para borrar la meta hay que mandar null a propósito", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await PUT(putReq({}));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockFijar).not.toHaveBeenCalled();
  });

  it("200: fija la meta del propio socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockFijar.mockResolvedValueOnce({ pesoObjetivo: 77, pesoInicial: 82.5 });

    const res = await PUT(putReq({ pesoObjetivo: 77, socioId: "socio-ajeno" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pesoObjetivo: 77, pesoInicial: 82.5 });
    expect(mockFijar).toHaveBeenCalledWith({ socioId: "socio-1", pesoObjetivo: 77 });
  });

  it("200: con null borra la meta", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockFijar.mockResolvedValueOnce({ pesoObjetivo: null, pesoInicial: null });

    const res = await PUT(putReq({ pesoObjetivo: null }));

    expect(res.status).toBe(200);
    expect(mockFijar).toHaveBeenCalledWith({ socioId: "socio-1", pesoObjetivo: null });
  });

  it("mapea los errores del dominio (por ejemplo, fijar una meta sin haberse pesado)", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockFijar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: Registrá tu peso antes de fijar una meta"));

    const res = await PUT(putReq({ pesoObjetivo: 77 }));

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Registrá tu peso antes de fijar una meta");
  });
});
