/** @jest-environment node */
/**
 * POST /api/sesiones/[id]/series (registrar serie) — T-037. NextRequest/NextResponse reales.
 * `params` es una promesa (Next 16, FX-06). La capa API va mockeada.
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
  handleRegistrarSerie,
  handleObtenerSesion,
  resolveSocioIdDeUsuario,
} from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { POST } from "./route";

const mockRegistrar = handleRegistrarSerie as jest.MockedFunction<typeof handleRegistrarSerie>;
const mockObtener = handleObtenerSesion as jest.MockedFunction<typeof handleObtenerSesion>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/sesiones/s1/series", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const ctx = (id = "s1") => ({ params: Promise.resolve({ id }) });

describe("POST /api/sesiones/[id]/series", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ ejercicioId: "ej-1", carga: 40, repeticiones: 10 }), ctx());
    expect(res.status).toBe(401);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("403 para INSTRUCTOR (solo lee)", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    const res = await POST(postReq({ ejercicioId: "ej-1", carga: 40, repeticiones: 10 }), ctx());
    expect(res.status).toBe(403);
    expect(mockObtener).not.toHaveBeenCalled();
  });

  it("404 si la sesión no existe", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce(null as never);
    const res = await POST(postReq({ ejercicioId: "ej-1", carga: 40, repeticiones: 10 }), ctx());
    expect(res.status).toBe(404);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("403 si un SOCIO registra una serie en la sesión de otro", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-2" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await POST(postReq({ ejercicioId: "ej-1", carga: 40, repeticiones: 10 }), ctx());

    expect(res.status).toBe(403);
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it.each([
    ["falta ejercicioId", { carga: 40, repeticiones: 10 }],
    ["falta carga", { ejercicioId: "ej-1", repeticiones: 10 }],
    ["falta repeticiones", { ejercicioId: "ej-1", carga: 40 }],
  ])("400 si %s", async (_caso, body) => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await POST(postReq(body), ctx());

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("201: un SOCIO registra una serie en su propia sesión", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");
    mockRegistrar.mockResolvedValueOnce({ registro: { id: "r1" }, sesion: { id: "s1" } } as never);

    const res = await POST(
      postReq({ ejercicioId: "ej-1", carga: 40, repeticiones: 10, rir: 2 }),
      ctx()
    );

    expect(res.status).toBe(201);
    expect(mockRegistrar).toHaveBeenCalledWith({
      sesionId: "s1",
      ejercicioId: "ej-1",
      carga: 40,
      repeticiones: 10,
      rir: 2,
    });
  });

  it("normaliza un RIR ausente a null", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");
    mockRegistrar.mockResolvedValueOnce({ registro: { id: "r1" }, sesion: { id: "s1" } } as never);

    const res = await POST(postReq({ ejercicioId: "ej-1", carga: 40, repeticiones: 10 }), ctx());

    expect(res.status).toBe(201);
    expect(mockRegistrar).toHaveBeenCalledWith(expect.objectContaining({ rir: null }));
  });

  it("400 (guarda EN_CURSO) si el dominio rechaza registrar", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockObtener.mockResolvedValueOnce({ id: "s1", socioId: "socio-1" } as never);
    mockResolver.mockResolvedValueOnce("socio-1");
    mockRegistrar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: La sesión no está en curso"));

    const res = await POST(postReq({ ejercicioId: "ej-1", carga: 40, repeticiones: 10 }), ctx());

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });
});
