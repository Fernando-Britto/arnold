/**
 * Route tests for GET /api/maquinas and POST /api/maquinas
 * T-053g — slice PR-1a-5
 */

import { GET, handleMaquinaListRequest } from "./route";
import { handleMaquinaList } from "@/api/maquinas";
import { extractUserFromRequest } from "@/lib/auth";
import type { Maquina } from "@/domains/maquina/maquina";
import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client";

jest.mock("@/api/maquinas");
jest.mock("@/lib/db");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));

const mockUser = extractUserFromRequest as jest.Mock;
const mockList = handleMaquinaList as jest.MockedFunction<typeof handleMaquinaList>;

const adminUser = { id: "u-admin", rol: "ADMINISTRADOR" };

const getReq = (search: string) =>
  ({
    nextUrl: new URL(`http://localhost/api/maquinas${search}`),
  }) as unknown as Parameters<typeof GET>[0];

const mockMaquinas: Maquina[] = [
  {
    id: "m1",
    nombre: "Polea alta",
    tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
    estado: "DISPONIBLE" as EstadoMaquina,
    ubicacion: "Sala principal",
    fechaAlta: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "m2",
    nombre: "Cinta",
    tipoEquipamiento: "CARDIO" as TipoEquipamiento,
    estado: "OCUPADA" as EstadoMaquina,
    ubicacion: "Sala principal",
    fechaAlta: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

describe("Maquina API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockReturnValue(adminUser);
  });

  describe("GET /api/maquinas", () => {
    it("lista todas las máquinas", async () => {
      mockList.mockResolvedValue(mockMaquinas);

      const res = await GET(getReq(""));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveLength(2);
      expect(json[0]).toMatchObject({ id: "m1", nombre: "Polea alta" });
      expect(json[1]).toMatchObject({ id: "m2", estado: "OCUPADA" });
      expect(mockList).toHaveBeenCalledWith({});
    });

    it("pasa estado, tipoEquipamiento y nombre como filtros", async () => {
      mockList.mockResolvedValue([mockMaquinas[0]]);

      const res = await GET(
        getReq("?estado=DISPONIBLE&tipoEquipamiento=MAQUINA_GUIADA&nombre=Polea")
      );

      expect(res.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({
        estado: "DISPONIBLE",
        tipoEquipamiento: "MAQUINA_GUIADA",
        nombre: "Polea",
      });
    });

    it("acepta estado=OCUPADA", async () => {
      mockList.mockResolvedValue([mockMaquinas[1]]);

      const res = await GET(getReq("?estado=OCUPADA"));

      expect(res.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith({ estado: "OCUPADA" });
    });

    it("devuelve [] cuando no hay resultados", async () => {
      mockList.mockResolvedValue([]);

      const res = await GET(getReq("?nombre=sin-resultados"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("responde 400 VALIDATION_ERROR para estado=FOO", async () => {
      const res = await GET(getReq("?estado=FOO"));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(json.message).toMatch(/estado/i);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("responde 400 VALIDATION_ERROR para tipoEquipamiento=FOO", async () => {
      const res = await GET(getReq("?tipoEquipamiento=FOO"));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(json.message).toMatch(/equipamiento/i);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("responde 400 cuando el handler lanza VALIDATION_ERROR", async () => {
      mockList.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El nombre debe tener entre 2 y 80 caracteres"),
          { code: "VALIDATION_ERROR" }
        )
      );

      const res = await GET(getReq(""));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("responde 403 a un rol distinto de ADMINISTRADOR", async () => {
      mockUser.mockReturnValue({ id: "u-instructor", rol: "INSTRUCTOR" });

      const res = await GET(getReq(""));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toMatchObject({
        code: "FORBIDDEN",
        message: "Se requiere rol de administrador",
      });
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe("handleMaquinaListRequest", () => {
    it("devuelve el resultado del handler", async () => {
      mockList.mockResolvedValue(mockMaquinas);

      const result = await handleMaquinaListRequest({ estado: "DISPONIBLE" });

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2);
      }
    });
  });
});
