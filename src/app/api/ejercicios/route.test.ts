/** @jest-environment node */
/**
 * Auditoría de operaciones en POST /api/ejercicios (finding C, P1).
 * Un alta exitosa registra RegistroDeAuditoria (ALTA) con el responsable y el id del ejercicio.
 */
import { NextRequest } from "next/server";

jest.unmock("next/server");
jest.mock("@/api/ejercicios");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

import { handleEjercicioCreate, handleEjercicioList } from "@/api/ejercicios";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import { GET, POST, parsePaginacion } from "./route";

const mockCreate = handleEjercicioCreate as jest.MockedFunction<typeof handleEjercicioCreate>;
const mockList = handleEjercicioList as jest.MockedFunction<typeof handleEjercicioList>;
const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;

const postReq = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/ejercicios", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("POST /api/ejercicios — auditoría", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra ALTA con responsableId y ejercicioId tras un alta exitosa", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCreate.mockResolvedValueOnce({ id: "e1", nombre: "Press" } as never);

    const res = await POST(postReq({ nombre: "Press" }));

    expect(res.status).toBe(201);
    expect(mockAudit).toHaveBeenCalledWith({
      tipoOperacion: "ALTA",
      responsableId: "u-admin",
      detalles: { ejercicioId: "e1" },
    });
  });

  it("no registra nada si el alta falla en el dominio", async () => {
    mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
    mockCreate.mockRejectedValueOnce(new Error("VALIDATION_ERROR: nombre requerido"));

    const res = await POST(postReq({}));

    expect(res.status).toBe(400);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

const getReq = (query: string) =>
  new NextRequest(`http://localhost:3000/api/ejercicios${query}`);

describe("parsePaginacion", () => {
  it("sin params devuelve { ok: true } sin limit ni offset", () => {
    expect(parsePaginacion(null, null)).toEqual({ ok: true });
  });

  it("acepta limit=50 y offset=20", () => {
    expect(parsePaginacion("50", "20")).toEqual({ ok: true, limit: 50, offset: 20 });
  });

  it("usa limit=20 y offset=0 por defecto cuando sólo llega uno", () => {
    expect(parsePaginacion("10", null)).toEqual({ ok: true, limit: 10, offset: 0 });
    expect(parsePaginacion(null, "5")).toEqual({ ok: true, limit: 20, offset: 5 });
  });

  it.each(["abc", "0", "-1", "51", "1.5", ""])(
    "rechaza limit inválido (%s)",
    (raw) => {
      expect(parsePaginacion(raw, null)).toEqual({
        ok: false,
        message: "El parámetro limit debe estar entre 1 y 50",
      });
    }
  );

  it.each(["abc", "-1", "1.5", ""])("rechaza offset inválido (%s)", (raw) => {
    expect(parsePaginacion(null, raw)).toEqual({
      ok: false,
      message: "El parámetro offset debe ser un número entero",
    });
  });
});

describe("GET /api/ejercicios — paginación", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sin params devuelve el listado completo, sin limit/offset", async () => {
    mockList.mockResolvedValueOnce([]);

    const res = await GET(getReq(""));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockList).toHaveBeenCalledWith({
      muscleGroup: undefined,
      search: undefined,
    });
  });

  it("responde 400 VALIDATION_ERROR con limit inválido", async () => {
    const res = await GET(getReq("?limit=51"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      message: "El parámetro limit debe estar entre 1 y 50",
    });
    expect(mockList).not.toHaveBeenCalled();
  });

  it("responde 400 VALIDATION_ERROR con offset inválido", async () => {
    const res = await GET(getReq("?offset=-1"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      message: "El parámetro offset debe ser un número entero",
    });
    expect(mockList).not.toHaveBeenCalled();
  });

  it("pasa limit/offset al handler", async () => {
    mockList.mockResolvedValueOnce([]);

    const res = await GET(getReq("?limit=50&offset=20"));

    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 20 })
    );
  });
});
