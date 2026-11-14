/** @jest-environment node */
/**
 * GET/POST /api/reasignaciones (P-61). NextRequest/NextResponse reales para ejercitar sesión y rol;
 * la capa API va mockeada.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/reasignaciones");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));

import { handleReasignar, handleSesionesEnCursoStaff } from "@/api/reasignaciones";
import { extractUserFromRequest } from "@/lib/auth";
import { GET, POST } from "./route";

const mockListar = handleSesionesEnCursoStaff as jest.MockedFunction<typeof handleSesionesEnCursoStaff>;
const mockReasignar = handleReasignar as jest.MockedFunction<typeof handleReasignar>;
const mockUser = extractUserFromRequest as jest.Mock;

const getReq = () => new NextRequest("http://localhost:3000/api/reasignaciones");
const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/reasignaciones", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("/api/reasignaciones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue([]);
    mockReasignar.mockResolvedValue({
      status: 200,
      body: { asignacionId: "asig-2", maquinaId: "m-2", maquinaNombre: "Polea alta" },
    });
  });

  it("sin sesión devuelve 401", async () => {
    mockUser.mockReturnValue(null);

    const res = await GET(getReq());

    expect(res.status).toBe(401);
    expect(mockListar).not.toHaveBeenCalled();
  });

  it.each(["SOCIO", "RECEPCIONISTA"])("el rol %s recibe 403", async (rol) => {
    mockUser.mockReturnValue({ id: "u-1", rol });

    const get = await GET(getReq());
    const post = await POST(postReq({ asignacionId: "a", maquinaId: "m" }));

    expect(get.status).toBe(403);
    expect(post.status).toBe(403);
    expect(mockListar).not.toHaveBeenCalled();
    expect(mockReasignar).not.toHaveBeenCalled();
  });

  it.each(["INSTRUCTOR", "ADMINISTRADOR"])("%s puede leer las sesiones en curso", async (rol) => {
    mockUser.mockReturnValue({ id: "u-1", rol });
    mockListar.mockResolvedValue([
      {
        sesionId: "ses-1",
        socioId: "socio-1",
        socioNombre: "Santiago Socio",
        horaInicio: "2026-11-12T18:00:00.000Z",
        ejercicioId: "e-1",
        ejercicioNombre: "Press inclinado",
        asignacionId: "asig-1",
        maquinaId: "m-1",
        maquinaNombre: "Banco plano",
        candidatos: [],
      },
    ]);

    const res = await GET(getReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("el POST delega con el responsable de la sesión", async () => {
    mockUser.mockReturnValue({ id: "u-instructor", rol: "INSTRUCTOR" });

    const res = await POST(postReq({ asignacionId: "asig-1", maquinaId: "m-2" }));

    expect(res.status).toBe(200);
    expect(mockReasignar).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { asignacionId: "asig-1", maquinaId: "m-2" },
        responsableId: "u-instructor",
      })
    );
  });

  it("un JSON inválido devuelve 400 sin llamar al handler", async () => {
    mockUser.mockReturnValue({ id: "u-instructor", rol: "INSTRUCTOR" });

    const res = await POST(postReq("{no es json"));

    expect(res.status).toBe(400);
    expect(mockReasignar).not.toHaveBeenCalled();
  });

  it("un 409 del handler se propaga con su mensaje", async () => {
    mockUser.mockReturnValue({ id: "u-instructor", rol: "INSTRUCTOR" });
    mockReasignar.mockResolvedValue({
      status: 409,
      body: { code: "MAQUINA_OCUPADA", message: "Esa máquina está ocupada" },
    });

    const res = await POST(postReq({ asignacionId: "asig-1", maquinaId: "m-2" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "MAQUINA_OCUPADA", message: "Esa máquina está ocupada" });
  });
});
