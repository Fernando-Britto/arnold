/**
 * Route tests for GET /api/maquinas/[id]
 * T-053h sub-slice 6a — GET only
 */

import {
  GET,
  PUT,
  DELETE,
  handleMaquinaGetByIdRequest,
  handleMaquinaUpdateRequest,
  handleMaquinaDeleteRequest,
  type GetSuccess,
  type UpdateSuccess,
  type DeleteSuccess,
} from "./route";
import {
  handleMaquinaGetById,
  handleMaquinaUpdate,
  handleMaquinaDelete,
} from "@/api/maquinas";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";
import type { Maquina } from "@/domains/maquina/maquina";
import type { EstadoMaquina, TipoEquipamiento } from "@prisma/client";

jest.mock("@/api/maquinas");
jest.mock("@/lib/db");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

const mockUser = extractUserFromRequest as jest.Mock;
const mockRegistrarOperacion = registrarOperacion as jest.MockedFunction<
  typeof registrarOperacion
>;
const mockGetById = handleMaquinaGetById as jest.MockedFunction<
  typeof handleMaquinaGetById
>;
const mockUpdate = handleMaquinaUpdate as jest.MockedFunction<
  typeof handleMaquinaUpdate
>;
const mockDelete = handleMaquinaDelete as jest.MockedFunction<
  typeof handleMaquinaDelete
>;

const adminUser = { id: "u-admin", rol: "ADMINISTRADOR" };

const getReq = () =>
  ({}) as unknown as Parameters<typeof GET>[0];
const putReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof PUT>[0];
const deleteReq = () =>
  ({}) as unknown as Parameters<typeof DELETE>[0];

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

  describe("PUT /api/maquinas/[id]", () => {
    it("actualiza y responde 200 pasando el id de await params y el body parseado", async () => {
      mockUpdate.mockResolvedValue(mockMaquina);
      const body = {
        nombre: "Polea baja",
        ubicacion: "Sala principal",
        tipoEquipamiento: "MAQUINA_GUIADA",
        estado: "DISPONIBLE",
      };

      const res = await PUT(putReq(body), ctx);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({ id: "m1", nombre: "Polea alta" });
      expect(mockUpdate).toHaveBeenCalledWith("m1", body);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("audita MODIFICACION con el id del actor y { maquinaId }", async () => {
      mockUpdate.mockResolvedValue(mockMaquina);

      await PUT(putReq({ estado: "DISPONIBLE" }), ctx);

      expect(mockRegistrarOperacion).toHaveBeenCalledWith({
        tipoOperacion: "MODIFICACION",
        responsableId: "u-admin",
        detalles: { maquinaId: "m1" },
      });
    });

    it("audita MODIFICACION en un cambio solo de estado", async () => {
      mockUpdate.mockResolvedValue(mockMaquina);

      await PUT(putReq({ estado: "INACTIVA" }), ctx);

      expect(mockRegistrarOperacion).toHaveBeenCalledWith({
        tipoOperacion: "MODIFICACION",
        responsableId: "u-admin",
        detalles: { maquinaId: "m1" },
      });
    });

    it("responde 404 NOT_FOUND cuando la máquina no existe", async () => {
      mockUpdate.mockRejectedValue(
        Object.assign(new Error("NOT_FOUND: Máquina no encontrada"), {
          code: "NOT_FOUND",
        })
      );

      const res = await PUT(putReq({ estado: "DISPONIBLE" }), ctx);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toEqual({
        code: "NOT_FOUND",
        message: "Máquina no encontrada",
      });
    });

    it("responde 400 VALIDATION_ERROR cuando el body es null", async () => {
      mockUpdate.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El cuerpo debe ser un objeto"),
          { code: "VALIDATION_ERROR" }
        )
      );

      const res = await PUT(putReq(null), ctx);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({
        code: "VALIDATION_ERROR",
        message: "El cuerpo debe ser un objeto",
      });
    });

    it("responde 400 VALIDATION_ERROR cuando el body es un array", async () => {
      mockUpdate.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El cuerpo debe ser un objeto"),
          { code: "VALIDATION_ERROR" }
        )
      );

      const res = await PUT(putReq([]), ctx);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({
        code: "VALIDATION_ERROR",
        message: "El cuerpo debe ser un objeto",
      });
    });

    it("un fallo de auditoría no cambia la respuesta 200", async () => {
      mockUpdate.mockResolvedValue(mockMaquina);
      mockRegistrarOperacion.mockRejectedValue(new Error("audit exploded"));

      const res = await PUT(putReq({ estado: "DISPONIBLE" }), ctx);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toMatchObject({ id: "m1", nombre: "Polea alta" });
    });

    it("responde 403 para un rol distinto de ADMINISTRADOR y no llama al handler", async () => {
      mockUser.mockReturnValue({
        id: "u-recepcionista",
        rol: "RECEPCIONISTA",
      });

      const res = await PUT(putReq({ estado: "DISPONIBLE" }), ctx);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toEqual({
        code: "FORBIDDEN",
        message: "Se requiere rol de administrador",
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/maquinas/[id]", () => {
    it("elimina y responde 204 sin cuerpo", async () => {
      mockDelete.mockResolvedValue(undefined);

      const res = await DELETE(deleteReq(), ctx);

      expect(res.status).toBe(204);
      // El mock global de next/server expone el cuerpo a través de json().
      expect(await res.json()).toBeNull();
      expect(mockDelete).toHaveBeenCalledWith("m1");
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("audita BAJA con { maquinaId: id }", async () => {
      mockDelete.mockResolvedValue(undefined);

      await DELETE(deleteReq(), ctx);

      expect(mockRegistrarOperacion).toHaveBeenCalledWith({
        tipoOperacion: "BAJA",
        responsableId: "u-admin",
        detalles: { maquinaId: "m1" },
      });
    });

    it("responde 404 NOT_FOUND cuando la máquina no existe", async () => {
      mockDelete.mockRejectedValue(
        Object.assign(new Error("NOT_FOUND: Máquina no encontrada"), {
          code: "NOT_FOUND",
        })
      );

      const res = await DELETE(deleteReq(), ctx);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toEqual({
        code: "NOT_FOUND",
        message: "Máquina no encontrada",
      });
    });

    it("responde 409 DELETE_BLOCKED_EJERCICIOS cuando el delete está bloqueado", async () => {
      mockDelete.mockRejectedValue(
        Object.assign(
          new Error(
            "DELETE_BLOCKED_EJERCICIOS: No se puede eliminar: 3 ejercicios usan esta máquina"
          ),
          { code: "DELETE_BLOCKED_EJERCICIOS" }
        )
      );

      const res = await DELETE(deleteReq(), ctx);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json).toEqual({
        code: "DELETE_BLOCKED_EJERCICIOS",
        message: "No se puede eliminar: 3 ejercicios usan esta máquina",
      });
    });

    it("un fallo de auditoría no cambia la respuesta 204", async () => {
      mockDelete.mockResolvedValue(undefined);
      mockRegistrarOperacion.mockRejectedValue(new Error("audit exploded"));

      const res = await DELETE(deleteReq(), ctx);

      expect(res.status).toBe(204);
      // El mock global de next/server expone el cuerpo a través de json().
      expect(await res.json()).toBeNull();
    });

    it("responde 403 para un rol distinto de ADMINISTRADOR y no llama al handler", async () => {
      mockUser.mockReturnValue({
        id: "u-recepcionista",
        rol: "RECEPCIONISTA",
      });

      const res = await DELETE(deleteReq(), ctx);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toEqual({
        code: "FORBIDDEN",
        message: "Se requiere rol de administrador",
      });
      expect(mockDelete).not.toHaveBeenCalled();
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

  describe("handleMaquinaUpdateRequest", () => {
    it("devuelve la máquina actualizada con status 200", async () => {
      mockUpdate.mockResolvedValue(mockMaquina);

      const result = await handleMaquinaUpdateRequest("m1", { estado: "DISPONIBLE" });

      expect((result as UpdateSuccess).status).toBe(200);
      expect((result as UpdateSuccess).id).toBe("m1");
    });

    it("mapea un error de validación a 400", async () => {
      mockUpdate.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El cuerpo debe ser un objeto"),
          { code: "VALIDATION_ERROR" }
        )
      );

      const result = await handleMaquinaUpdateRequest("m1", null);

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(400);
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("handleMaquinaDeleteRequest", () => {
    it("devuelve el mensaje de éxito con status 204", async () => {
      mockDelete.mockResolvedValue(undefined);

      const result = await handleMaquinaDeleteRequest("m1");

      expect((result as DeleteSuccess).status).toBe(204);
      expect((result as DeleteSuccess).message).toBe("Máquina eliminada");
    });

    it("mapea DELETE_BLOCKED_EJERCICIOS a 409", async () => {
      mockDelete.mockRejectedValue(
        Object.assign(
          new Error(
            "DELETE_BLOCKED_EJERCICIOS: No se puede eliminar: 2 ejercicios usan esta máquina"
          ),
          { code: "DELETE_BLOCKED_EJERCICIOS" }
        )
      );

      const result = await handleMaquinaDeleteRequest("m1");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(409);
        expect(result.code).toBe("DELETE_BLOCKED_EJERCICIOS");
      }
    });
  });
});
