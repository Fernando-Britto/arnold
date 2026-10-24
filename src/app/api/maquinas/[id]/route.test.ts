/**
 * Route tests for GET /api/maquinas/[id]
 * T-053h sub-slice 6a — GET only
 */

import { GET, handleMaquinaGetByIdRequest, type GetSuccess } from "./route";
import { handleMaquinaGetById } from "@/api/maquinas";
import { extractUserFromRequest } from "@/lib/auth";
import type { Maquina } from "@/domains/maquina/maquina";
import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client";

jest.mock("@/api/maquinas");
jest.mock("@/lib/db");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));

const mockUser = extractUserFromRequest as jest.Mock;
const mockGetById = handleMaquinaGetById as jest.MockedFunction<
  typeof handleMaquinaGetById
>;

const adminUser = { id: "u-admin", rol: "ADMINISTRADOR" };

const getReq = () =>
  ({}) as unknown as Parameters<typeof GET>[0];

const ctx = { params: Promise.resolve({ id: "m1" }) };

const mockMaquina: Maquina = {
  id: "m1",
  nombre: "Polea alta",
  tipoEquipamiento: "MAQUINA_GUIADA" as TipoEquipamiento,
  estado: "DISPONIBLE" as EstadoMaquina,
  ubicacion: "Sala principal",
  fechaAlta: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Maquina [id] API Routes — GET", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockReturnValue(adminUser);
  });

  describe("GET /api/maquinas/[id]", () => {
    it("devuelve la máquina por id (200) y pasa el id de await params", async () => {
      mockGetById.mockResolvedValue(mockMaquina);

      const res = await GET(getReq(), ctx);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({ id: "m1", nombre: "Polea alta" });
      expect(mockGetById).toHaveBeenCalledWith("m1");
      expect(mockGetById).toHaveBeenCalledTimes(1);
    });

    it("responde 404 NOT_FOUND con \"Máquina no encontrada\" cuando el handler lanza NOT_FOUND", async () => {
      mockGetById.mockRejectedValue(
        Object.assign(new Error("NOT_FOUND: Máquina no encontrada"), {
          code: "NOT_FOUND",
        })
      );

      const res = await GET(getReq(), ctx);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toEqual({
        code: "NOT_FOUND",
        message: "Máquina no encontrada",
      });
    });

    it("responde 401 cuando no hay usuario autenticado", async () => {
      mockUser.mockReturnValue(null);

      const res = await GET(getReq(), ctx);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Token de autenticación inválido o faltante",
      });
      expect(mockGetById).not.toHaveBeenCalled();
    });

    it("responde 403 para un rol distinto de ADMINISTRADOR y no llama al handler", async () => {
      mockUser.mockReturnValue({ id: "u-recepcionista", rol: "RECEPCIONISTA" });

      const res = await GET(getReq(), ctx);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toEqual({
        code: "FORBIDDEN",
        message: "Se requiere rol de administrador",
      });
      expect(mockGetById).not.toHaveBeenCalled();
    });
  });

  describe("handleMaquinaGetByIdRequest", () => {
    it("mapea un error inesperado a 500 SERVER_ERROR", async () => {
      mockGetById.mockRejectedValue(new Error("explosión inesperada"));

      const result = await handleMaquinaGetByIdRequest("m1");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(500);
        expect(result.code).toBe("SERVER_ERROR");
        expect(result.message).toBe("No se pudo procesar la solicitud");
      }
    });

    it("devuelve la máquina con status 200", async () => {
      mockGetById.mockResolvedValue(mockMaquina);

      const result = await handleMaquinaGetByIdRequest("m1");

      expect((result as GetSuccess).status).toBe(200);
      expect((result as GetSuccess).id).toBe("m1");
    });
  });
});
