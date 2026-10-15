/** @jest-environment node */
/**
 * POST /api/rutinas-asignadas (asignar) y GET /api/rutinas-asignadas?socioId= (listar) — T-034.
 * NextRequest/NextResponse reales (jest.unmock) para ejercitar sesión y rol, igual que /api/pagos.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/lib/db", () => ({ prisma: {} }));
jest.mock("@/api/rutinas-asignadas");
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  extractUserFromRequest: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleAsignarRutina, handleListarRutinasDeSocio } from "@/api/rutinas-asignadas";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import {
  POST,
  GET,
  handleAsignarRutinaRequest,
  handleListarRutinasDeSocioRequest,
} from "./route";

const mockAsignar = handleAsignarRutina as jest.MockedFunction<typeof handleAsignarRutina>;
const mockListar = handleListarRutinasDeSocio as jest.MockedFunction<
  typeof handleListarRutinasDeSocio
>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const asignacionFalsa = {
  id: "asig-1",
  socioId: "socio-1",
  rutinaId: "rutina-1",
  activa: true,
  rutina: { id: "rutina-1", nombre: "Full Body" },
};

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/rutinas-asignadas", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const getReq = (qs = "") => new NextRequest(`http://localhost:3000/api/rutinas-asignadas${qs}`);

describe("handleAsignarRutinaRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 con success y la rutina asignada", async () => {
    mockAsignar.mockResolvedValueOnce(asignacionFalsa as never);

    const r = await handleAsignarRutinaRequest({ socioId: "socio-1", rutinaId: "rutina-1" });

    expect(r.status).toBe(201);
    expect(r.body).toEqual(
      expect.objectContaining({ success: true, rutinaAsignada: asignacionFalsa })
    );
  });

  it("404 si el socio no existe", async () => {
    mockAsignar.mockRejectedValueOnce(new Error("NOT_FOUND: Socio no encontrado"));

    const r = await handleAsignarRutinaRequest({ socioId: "nope", rutinaId: "rutina-1" });

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
    expect((r.body as { message: string }).message).toContain("Socio");
  });

  it("404 si la rutina no existe (mensaje distinto al de socio)", async () => {
    mockAsignar.mockRejectedValueOnce(new Error("NOT_FOUND: Rutina no encontrada"));

    const r = await handleAsignarRutinaRequest({ socioId: "socio-1", rutinaId: "nope" });

    expect(r.status).toBe(404);
    expect((r.body as { code: string }).code).toBe("NOT_FOUND");
    expect((r.body as { message: string }).message).toContain("Rutina");
  });

  it("400 si el input es inválido", async () => {
    mockAsignar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: Rutina requerida"));

    const r = await handleAsignarRutinaRequest({ socioId: "socio-1", rutinaId: "" });

    expect(r.status).toBe(400);
    expect((r.body as { code: string }).code).toBe("VALIDATION_ERROR");
  });
});

describe("handleListarRutinasDeSocioRequest (sin NextRequest)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 con la lista de asignaciones del socio", async () => {
    mockListar.mockResolvedValueOnce([asignacionFalsa] as never);

    const r = await handleListarRutinasDeSocioRequest("socio-1");

    expect(r.status).toBe(200);
    expect(r.body).toEqual([asignacionFalsa]);
    expect(mockListar).toHaveBeenCalledWith("socio-1");
  });
});

describe("POST /api/rutinas-asignadas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await POST(postReq({ socioId: "socio-1", rutinaId: "rutina-1" }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
    expect(mockAsignar).not.toHaveBeenCalled();
  });

  it("403 para RECEPCIONISTA (rol no autorizado)", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await POST(postReq({ socioId: "socio-1", rutinaId: "rutina-1" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
    expect(mockAsignar).not.toHaveBeenCalled();
  });

  it("400 con cuerpo inválido", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    const res = await POST(
      new NextRequest("http://localhost:3000/api/rutinas-asignadas", {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    expect(mockAsignar).not.toHaveBeenCalled();
  });

  it("201 para INSTRUCTOR con un socio y rutina válidos", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    mockAsignar.mockResolvedValueOnce(asignacionFalsa as never);

    const res = await POST(postReq({ socioId: "socio-1", rutinaId: "rutina-1" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(
      expect.objectContaining({ success: true, rutinaAsignada: asignacionFalsa })
    );
    expect(mockAsignar).toHaveBeenCalledWith({ socioId: "socio-1", rutinaId: "rutina-1" });
  });

  // NF-15 / D-32: la asignación deja auditoría de negocio.
  it("registra ALTA con responsableId, socioId y rutinaId tras una asignación exitosa", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    mockAsignar.mockResolvedValueOnce(asignacionFalsa as never);

    const res = await POST(postReq({ socioId: "socio-1", rutinaId: "rutina-1" }));

    expect(res.status).toBe(201);
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "ALTA",
      responsableId: "u-inst",
      detalles: { socioId: "socio-1", rutinaId: "rutina-1" },
    });
  });

  it("no registra auditoría si la asignación falla en el dominio", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    mockAsignar.mockRejectedValueOnce(new Error("VALIDATION_ERROR: Rutina requerida"));

    const res = await POST(postReq({ socioId: "socio-1", rutinaId: "" }));

    expect(res.status).toBe(400);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

describe("GET /api/rutinas-asignadas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("401 sin sesión", async () => {
    mockUser.mockReturnValue(null);
    const res = await GET(getReq("?socioId=socio-1"));
    expect(res.status).toBe(401);
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("403 para RECEPCIONISTA", async () => {
    mockUser.mockReturnValue({ id: "u-rec", rol: "RECEPCIONISTA" });
    const res = await GET(getReq("?socioId=socio-1"));
    expect(res.status).toBe(403);
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("400 si falta socioId", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    const res = await GET(getReq());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_REQUIRED");
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("200 con las asignaciones del socio para INSTRUCTOR", async () => {
    mockUser.mockReturnValue({ id: "u-inst", rol: "INSTRUCTOR" });
    mockListar.mockResolvedValueOnce([asignacionFalsa] as never);

    const res = await GET(getReq("?socioId=socio-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([asignacionFalsa]);
    expect(mockListar).toHaveBeenCalledWith("socio-1");
  });
});
