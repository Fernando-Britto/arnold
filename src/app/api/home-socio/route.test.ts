/** @jest-environment node */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/home-socio-data");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { buildHomeSocioPayload } from "@/api/home-socio-data";
import { extractUserFromRequest } from "@/lib/auth";
import { GET } from "./route";

const mockBuild = buildHomeSocioPayload as jest.Mock;
const mockUser = extractUserFromRequest as jest.Mock;
const req = () => new NextRequest("http://localhost:3000/api/home-socio");

describe("GET /api/home-socio", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it.each(["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"])("403 para %s (Home_Socio es solo del Socio)", async (rol) => {
    mockUser.mockReturnValue({ id: "u1", rol });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it("200 con el payload del socio de la sesión y sin caché", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockBuild.mockResolvedValue({ sesionEnProgreso: false });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ sesionEnProgreso: false });
    expect(mockBuild).toHaveBeenCalledWith("u-socio"); // la identidad sale de la sesión, nunca de la URL
  });

  it("404 si el usuario Socio no tiene perfil de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockBuild.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("SOCIO_NOT_FOUND");
  });

  it("500 genérico y detalle solo en el log si falla la base", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockBuild.mockRejectedValue(new Error("db down 10.0.0.1"));

    const res = await GET(req());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("HOME_SOCIO_ERROR");
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
    expect(console.error).toHaveBeenCalled();
  });
});
