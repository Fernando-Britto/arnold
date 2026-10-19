/** @jest-environment node */
/**
 * POST /api/sesiones (iniciar) y GET /api/sesiones?enCurso=1 (sesión en curso) — T-037.
 * NextRequest/NextResponse reales para ejercitar sesión, rol y pertenencia (igual que /api/socios).
 * La capa API va mockeada: acá se verifica la autorización y el filtrado por socio.
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
  handleIniciarSesion,
  handleSesionEnCurso,
  resolveSocioIdDeUsuario,
} from "@/api/sesiones";
import { extractUserFromRequest } from "@/lib/auth";
import { GET, POST } from "./route";

const mockIniciar = handleIniciarSesion as jest.MockedFunction<typeof handleIniciarSesion>;
const mockEnCurso = handleSesionEnCurso as jest.MockedFunction<typeof handleSesionEnCurso>;
const mockResolver = resolveSocioIdDeUsuario as jest.MockedFunction<typeof resolveSocioIdDeUsuario>;
const mockUser = extractUserFromRequest as jest.Mock;

const iniciada = {
  sesion: { id: "s1", socioId: "socio-1", estadoDeFinalizacion: "EN_CURSO" },
  ejercicios: [],
};

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/sesiones", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const getReq = (qs = "") => new NextRequest(`http://localhost:3000/api/sesiones${qs}`);

describe("POST /api/sesiones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ rutinaAsignadaId: "asig-1" }));
    expect(res.status).toBe(401);
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("403 para un rol que solo lee (INSTRUCTOR)", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "INSTRUCTOR" });
    const res = await POST(postReq({ rutinaAsignadaId: "asig-1" }));
    expect(res.status).toBe(403);
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("403 para RECEPCIONISTA", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "RECEPCIONISTA" });
    const res = await POST(postReq({ rutinaAsignadaId: "asig-1" }));
    expect(res.status).toBe(403);
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("400 si falta rutinaAsignadaId", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("400 si el cuerpo no es JSON", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    const bad = new NextRequest("http://localhost:3000/api/sesiones", {
      method: "POST",
      body: "no-es-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("201: un SOCIO inicia sobre su propio socio (el socioId sale del usuario)", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockIniciar.mockResolvedValueOnce(iniciada as never);

    const res = await POST(postReq({ rutinaAsignadaId: "asig-1" }));

    expect(res.status).toBe(201);
    expect(mockIniciar).toHaveBeenCalledWith({ socioId: "socio-1", rutinaAsignadaId: "asig-1" });
  });

  it("403 si un SOCIO intenta iniciar para otro socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await POST(postReq({ rutinaAsignadaId: "asig-1", socioId: "socio-2" }));

    expect(res.status).toBe(403);
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("404 si el usuario SOCIO no tiene fila de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce(null);

    const res = await POST(postReq({ rutinaAsignadaId: "asig-1" }));

    expect(res.status).toBe(404);
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("201: un ADMINISTRADOR inicia indicando el socioId", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockIniciar.mockResolvedValueOnce(iniciada as never);

    const res = await POST(postReq({ rutinaAsignadaId: "asig-1", socioId: "socio-9" }));

    expect(res.status).toBe(201);
    expect(mockIniciar).toHaveBeenCalledWith({ socioId: "socio-9", rutinaAsignadaId: "asig-1" });
  });

  it("400 si un ADMINISTRADOR no indica el socioId", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    const res = await POST(postReq({ rutinaAsignadaId: "asig-1" }));
    expect(res.status).toBe(400);
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("mapea los errores de validación del dominio a 400", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    mockIniciar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: La rutina asignada no está activa"));

    const res = await POST(postReq({ rutinaAsignadaId: "asig-1" }));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  // SE-6: el 404 lleva el recurso que falta en el mensaje del dominio, no un texto fijo.
  it("404 con el mensaje del socio cuando falta el socio", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockIniciar.mockRejectedValueOnce(
      Object.assign(new Error("NOT_FOUND: Socio no encontrado"), { code: "NOT_FOUND" })
    );

    const res = await POST(postReq({ rutinaAsignadaId: "asig-1", socioId: "socio-9" }));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toContain("Socio");
    expect(body.message).not.toContain("Rutina asignada");
  });

  it("404 con el mensaje de la asignación cuando falta la rutina asignada", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockIniciar.mockRejectedValueOnce(
      Object.assign(new Error("NOT_FOUND: Rutina asignada no encontrada"), { code: "NOT_FOUND" })
    );

    const res = await POST(postReq({ rutinaAsignadaId: "asig-1", socioId: "socio-9" }));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toContain("Rutina asignada");
  });
});

describe("GET /api/sesiones?enCurso=1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq("?enCurso=1"));
    expect(res.status).toBe(401);
    expect(mockEnCurso).not.toHaveBeenCalled();
  });

  it("403 para RECEPCIONISTA", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "RECEPCIONISTA" });
    const res = await GET(getReq("?enCurso=1"));
    expect(res.status).toBe(403);
    expect(mockEnCurso).not.toHaveBeenCalled();
  });

  it("400 si no se pide enCurso=1", async () => {
    mockUser.mockReturnValue({ id: "u1", rol: "SOCIO" });
    const res = await GET(getReq());
    expect(res.status).toBe(400);
    expect(mockEnCurso).not.toHaveBeenCalled();
  });

  it("200: un SOCIO consulta su propia sesión en curso", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");
    const detalle = {
      sesion: { id: "s1", serieActual: 2 },
      ejercicios: [],
      ultimaSerie: null,
      cargaActual: null,
      ultimasVeces: {
        "ej-1": {
          fecha: "2026-10-10T13:00:00.000Z",
          series: [{ carga: 40, repeticiones: 10, rir: 2 }],
        },
      },
      sugerencias: {
        "ej-1": { tipo: "subir", carga: 42.5, motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg." },
      },
    };
    mockEnCurso.mockResolvedValueOnce(detalle as never);

    const res = await GET(getReq("?enCurso=1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(detalle);
    expect(mockEnCurso).toHaveBeenCalledWith("socio-1");
  });

  it("403 si un SOCIO pide la sesión de otro socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce("socio-1");

    const res = await GET(getReq("?enCurso=1&socioId=socio-2"));

    expect(res.status).toBe(403);
    expect(mockEnCurso).not.toHaveBeenCalled();
  });

  it("200: un INSTRUCTOR lee la sesión de un socio indicado", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    mockEnCurso.mockResolvedValueOnce(null as never);

    const res = await GET(getReq("?enCurso=1&socioId=socio-9"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sesion: null,
      ejercicios: [],
      ultimaSerie: null,
      cargaActual: null,
      ultimasVeces: {},
      sugerencias: {},
      records: {},
    });
    expect(mockEnCurso).toHaveBeenCalledWith("socio-9");
  });

  it("400 si el staff no indica el socioId", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    const res = await GET(getReq("?enCurso=1"));
    expect(res.status).toBe(400);
    expect(mockEnCurso).not.toHaveBeenCalled();
  });

  it("404 si el usuario SOCIO no tiene fila de socio", async () => {
    mockUser.mockReturnValue({ id: "u-socio", rol: "SOCIO" });
    mockResolver.mockResolvedValueOnce(null);
    const res = await GET(getReq("?enCurso=1"));
    expect(res.status).toBe(404);
    expect(mockEnCurso).not.toHaveBeenCalled();
  });
});
