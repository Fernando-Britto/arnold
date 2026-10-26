/** @jest-environment node */
/**
 * GET /api/home-socio/musculos — balance muscular del propio socio (T-051 parte 2, D-107).
 * La capa API va mockeada; NextRequest/NextResponse son los reales.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/balance-muscular");
jest.mock("@/api/sesiones");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleBalanceMuscular } from "@/api/balance-muscular";
import { resolveSocioIdDeUsuario } from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { GET } from "./route";

const mockBalance = handleBalanceMuscular as jest.MockedFunction<typeof handleBalanceMuscular>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const req = (query = "") => new NextRequest(`http://localhost:3000/api/home-socio/musculos${query}`);
const vacio = { periodo: "semana", desde: null, totalSeries: 0, musculos: [], sinTrabajar: [] } as never;

describe("GET /api/home-socio/musculos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockBalance).not.toHaveBeenCalled();
  });

  it.each(["ADMINISTRADOR", "INSTRUCTOR", "RECEPCIONISTA"])("403 para %s: es del socio", async (rol) => {
    mockUser.mockReturnValue({ id: "u-staff", rol });

    const res = await GET(req());

    expect(res.status).toBe(403);
    expect(mockBalance).not.toHaveBeenCalled();
  });

  it("404 si el usuario socio no tiene perfil de socio", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    mockResolver.mockResolvedValue(null);

    const res = await GET(req());

    expect(res.status).toBe(404);
  });

  it("400 con un período que no existe, sin tocar la base", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    mockResolver.mockResolvedValue("socio-1");

    const res = await GET(req("?periodo=año"));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_PERIODO");
    expect(mockBalance).not.toHaveBeenCalled();
  });

  it("sin período usa la semana", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    mockResolver.mockResolvedValue("socio-1");
    mockBalance.mockResolvedValue(vacio);

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(mockBalance).toHaveBeenCalledWith({ socioId: "socio-1", periodo: "semana" });
  });

  it.each(["semana", "30d", "90d", "todo"])("200 con el período %s, del socio que sale del token", async (periodo) => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    mockResolver.mockResolvedValue("socio-1");
    mockBalance.mockResolvedValue({ ...(vacio as object), periodo } as never);

    const res = await GET(req(`?periodo=${periodo}&socioId=otro`));

    expect(res.status).toBe(200);
    // Un socioId en la URL se ignora: la identidad sale SIEMPRE del token.
    expect(mockBalance).toHaveBeenCalledWith({ socioId: "socio-1", periodo });
    expect(mockResolver).toHaveBeenCalledWith("u1");
    expect((await res.json()).periodo).toBe(periodo);
  });

  it("no se guarda en caché: son datos en vivo", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    mockResolver.mockResolvedValue("socio-1");
    mockBalance.mockResolvedValue(vacio);

    const res = await GET(req());

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("500 ante un error inesperado, sin filtrar el detalle", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    mockResolver.mockResolvedValue("socio-1");
    mockBalance.mockRejectedValue(new Error("connection refused"));

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("connection refused");
  });
});
