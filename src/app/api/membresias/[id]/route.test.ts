/**
 * Integration tests for GET/PUT/DELETE /api/membresias/[id]
 * T-016: Membresia API layer CRUD
 * 
 * Critical tests for AC-005 (deactivation warning) and AC-006 (delete blocking)
 */

import {
  PUT as putMembresia,
  DELETE as delMembresia,
  handleMembresiaGetByIdRequest,
  handleMembresiaUpdateRequest,
  handleMembresiaDeleteRequest,
  type GetSuccess,
  type UpdateSuccess,
  type DeleteSuccess,
} from "./route";
import {
  handleMembresiaGetById,
  handleMembresiaUpdate,
  handleMembresiaDelete,
} from "@/api/membresias";
import { extractUserFromRequest } from "@/lib/auth";
import { registrarOperacion } from "@/lib/audit";

// Mock the API layer
jest.mock("@/api/membresias");
jest.mock("@/lib/db");
jest.mock("@/lib/auth", () => ({ extractUserFromRequest: jest.fn() }));
jest.mock("@/lib/audit", () => ({ registrarOperacion: jest.fn() }));

const mockUser = extractUserFromRequest as jest.Mock;
const mockAudit = registrarOperacion as jest.Mock;
const ctx = { params: Promise.resolve({ id: "m1" }) };
const jsonReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as Parameters<typeof putMembresia>[0];

describe("Membresia [id] API Routes", () => {
  const mockMembresia = {
    id: "1",
    nombre: "Gold",
    precio: 15000,
    periodicidad: 30,
    descripcion: "Plan Gold",
    estado: "ACTIVA" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/membresias/[id]", () => {
    it("should return single membresia by id with assignedSocioCount", async () => {
      const mockGetById = handleMembresiaGetById as jest.MockedFunction<
        typeof handleMembresiaGetById
      >;
      mockGetById.mockResolvedValue({
        ...mockMembresia,
        assignedSocioCount: 5,
      });

      const result = await handleMembresiaGetByIdRequest("1");

      expect((result as GetSuccess).status).toBe(200);
      expect((result as GetSuccess).id).toBe("1");
      expect((result as GetSuccess).nombre).toBe("Gold");
      expect((result as GetSuccess).assignedSocioCount).toBe(5);
    });

    it("should return 404 if membresia not found", async () => {
      const mockGetById = handleMembresiaGetById as jest.MockedFunction<
        typeof handleMembresiaGetById
      >;
      mockGetById.mockRejectedValue(
        Object.assign(new Error("NOT_FOUND: Membresía no encontrada"), {
          code: "NOT_FOUND",
        })
      );

      const result = await handleMembresiaGetByIdRequest("nonexistent");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("PUT /api/membresias/[id]", () => {
    describe("AC-005: Deactivation Warning (two-step confirmation)", () => {
      it("should return DEACTIVATION_WARNING when trying to deactivate without confirmation", async () => {
        const mockUpdate = handleMembresiaUpdate as jest.MockedFunction<
          typeof handleMembresiaUpdate
        >;
        mockUpdate.mockRejectedValue(
          Object.assign(
            new Error(
              "DEACTIVATION_WARNING: 5 socios tienen esta membresía asignada"
            ),
            {
              code: "DEACTIVATION_WARNING",
              assignedCount: 5,
            }
          )
        );

        const result = await handleMembresiaUpdateRequest("1", {
          estado: "INACTIVA",
          // No confirmarDesactivacion
        });

        expect("code" in result).toBe(true);
        if ("code" in result) {
          expect(result.code).toBe("DEACTIVATION_WARNING");
          expect(result.status).toBe(400);
          expect(result.message).toContain("5 socios");
        }
      });

      it("should allow deactivation when confirmarDesactivacion === true (AC-005)", async () => {
        const mockUpdate = handleMembresiaUpdate as jest.MockedFunction<
          typeof handleMembresiaUpdate
        >;
        const deactivatedMembresia = {
          ...mockMembresia,
          estado: "INACTIVA" as const,
          assignedSocioCount: 5,
        };
        mockUpdate.mockResolvedValue(deactivatedMembresia);

        const result = await handleMembresiaUpdateRequest("1", {
          estado: "INACTIVA",
          confirmarDesactivacion: true,
        });

        expect((result as UpdateSuccess).status).toBe(200);
        expect((result as UpdateSuccess).estado).toBe("INACTIVA");
        expect((result as UpdateSuccess).assignedSocioCount).toBe(5);
      });

      it("should complete full AC-005 flow: warn → reject → confirm → succeed", async () => {
        const mockUpdate = handleMembresiaUpdate as jest.MockedFunction<
          typeof handleMembresiaUpdate
        >;

        // Step 1: Try without confirmation → DEACTIVATION_WARNING
        mockUpdate.mockRejectedValueOnce(
          Object.assign(
            new Error(
              "DEACTIVATION_WARNING: 5 socios tienen esta membresía asignada"
            ),
            {
              code: "DEACTIVATION_WARNING",
              assignedCount: 5,
            }
          )
        );

        const result1 = await handleMembresiaUpdateRequest("1", {
          estado: "INACTIVA",
        });

        expect("code" in result1).toBe(true);
        if ("code" in result1) {
          expect(result1.code).toBe("DEACTIVATION_WARNING");
        }

        // Step 2: Try again with confirmation → Success
        mockUpdate.mockResolvedValueOnce({
          ...mockMembresia,
          estado: "INACTIVA",
          assignedSocioCount: 5,
        });

        const result2 = await handleMembresiaUpdateRequest("1", {
          estado: "INACTIVA",
          confirmarDesactivacion: true,
        });

        expect((result2 as UpdateSuccess).status).toBe(200);
        expect((result2 as UpdateSuccess).estado).toBe("INACTIVA");
      });
    });

    it("should update membresia successfully with valid data", async () => {
      const mockUpdate = handleMembresiaUpdate as jest.MockedFunction<
        typeof handleMembresiaUpdate
      >;
      const updatedMembresia = {
        ...mockMembresia,
        nombre: "Platinum",
        precio: 25000,
        assignedSocioCount: 0,
      };
      mockUpdate.mockResolvedValue(updatedMembresia);

      const result = await handleMembresiaUpdateRequest("1", {
        nombre: "Platinum",
        precio: 25000,
      });

      expect((result as UpdateSuccess).status).toBe(200);
      expect((result as UpdateSuccess).nombre).toBe("Platinum");
      expect((result as UpdateSuccess).precio).toBe(25000);
    });

    it("should return 404 if membresia not found", async () => {
      const mockUpdate = handleMembresiaUpdate as jest.MockedFunction<
        typeof handleMembresiaUpdate
      >;
      mockUpdate.mockRejectedValue(
        Object.assign(new Error("NOT_FOUND: Membresía no encontrada"), {
          code: "NOT_FOUND",
        })
      );

      const result = await handleMembresiaUpdateRequest("nonexistent", {
        nombre: "Updated",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("DELETE /api/membresias/[id]", () => {
    describe("AC-006: Delete Blocking (when assigned socios > 0)", () => {
      it("should block deletion with DELETE_BLOCKED_ASSIGNED when socios assigned", async () => {
        const mockDelete = handleMembresiaDelete as jest.MockedFunction<
          typeof handleMembresiaDelete
        >;
        mockDelete.mockRejectedValue(
          Object.assign(
            new Error(
              "DELETE_BLOCKED_ASSIGNED: No se puede eliminar: 5 socios asignados"
            ),
            {
              code: "DELETE_BLOCKED_ASSIGNED",
              assignedCount: 5,
            }
          )
        );

        const result = await handleMembresiaDeleteRequest("1");

        expect("code" in result).toBe(true);
        if ("code" in result) {
          expect(result.code).toBe("DELETE_BLOCKED_ASSIGNED");
          expect(result.status).toBe(409);
          expect(result.message).toContain("5 socios");
        }
      });

      it("should delete successfully if no socios assigned", async () => {
        const mockDelete = handleMembresiaDelete as jest.MockedFunction<
          typeof handleMembresiaDelete
        >;
        mockDelete.mockResolvedValue(undefined); // void function

        const result = await handleMembresiaDeleteRequest("2");

        expect((result as DeleteSuccess).status).toBe(204);
        expect((result as DeleteSuccess).message).toBeDefined();
      });

      it("should show DELETE_BLOCKED_ASSIGNED error with assigned count", async () => {
        const mockDelete = handleMembresiaDelete as jest.MockedFunction<
          typeof handleMembresiaDelete
        >;
        mockDelete.mockRejectedValue(
          Object.assign(
            new Error(
              "DELETE_BLOCKED_ASSIGNED: No se puede eliminar: 42 socios asignados"
            ),
            {
              code: "DELETE_BLOCKED_ASSIGNED",
              assignedCount: 42,
            }
          )
        );

        const result = await handleMembresiaDeleteRequest("gold");

        expect("code" in result).toBe(true);
        if ("code" in result) {
          expect(result.code).toBe("DELETE_BLOCKED_ASSIGNED");
          expect(result.message).toContain("42");
        }
      });
    });

    it("should return 404 if membresia not found", async () => {
      const mockDelete = handleMembresiaDelete as jest.MockedFunction<
        typeof handleMembresiaDelete
      >;
      mockDelete.mockRejectedValue(
        Object.assign(new Error("NOT_FOUND: Membresía no encontrada"), {
          code: "NOT_FOUND",
        })
      );

      const result = await handleMembresiaDeleteRequest("nonexistent");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("PUT /api/membresias/[id] — malformed JSON body", () => {
    it("should return 400 (not 500) when the body is not valid JSON", async () => {
      const malformed = {
        json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token 'o'")),
      } as unknown as Parameters<typeof putMembresia>[0];

      const res = await putMembresia(malformed, {
        params: Promise.resolve({ id: "1" }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        code: "VALIDATION_ERROR",
        message: "El cuerpo de la solicitud no es JSON válido",
      });
      expect(handleMembresiaUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Auditoría de operaciones en /api/membresias/[id]", () => {
    beforeEach(() => jest.clearAllMocks());

    it("PUT exitoso registra MODIFICACION con responsableId y membresiaId", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockUpdate = handleMembresiaUpdate as jest.MockedFunction<
        typeof handleMembresiaUpdate
      >;
      mockUpdate.mockResolvedValueOnce({ id: "m1", nombre: "Platinum" } as never);

      const res = await putMembresia(jsonReq({ nombre: "Platinum" }), ctx);

      expect(res.status).toBe(200);
      expect(mockAudit).toHaveBeenCalledWith({
        tipoOperacion: "MODIFICACION",
        responsableId: "u-admin",
        detalles: { membresiaId: "m1" },
      });
    });

    it("PUT fallido no registra nada", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockUpdate = handleMembresiaUpdate as jest.MockedFunction<
        typeof handleMembresiaUpdate
      >;
      mockUpdate.mockRejectedValueOnce(
        Object.assign(new Error("VALIDATION_ERROR: El precio debe ser mayor a 0"), {
          code: "VALIDATION_ERROR",
        })
      );

      const res = await putMembresia(jsonReq({ precio: 0 }), ctx);

      expect(res.status).toBe(400);
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("DELETE exitoso registra BAJA con responsableId y membresiaId", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockDelete = handleMembresiaDelete as jest.MockedFunction<
        typeof handleMembresiaDelete
      >;
      mockDelete.mockResolvedValueOnce(undefined);

      const res = await delMembresia(jsonReq(undefined), ctx);

      expect(res.status).toBe(204);
      expect(mockAudit).toHaveBeenCalledWith({
        tipoOperacion: "BAJA",
        responsableId: "u-admin",
        detalles: { membresiaId: "m1" },
      });
    });

    it("DELETE bloqueado no registra nada", async () => {
      mockUser.mockReturnValue({ id: "u-admin", rol: "ADMINISTRADOR" });
      const mockDelete = handleMembresiaDelete as jest.MockedFunction<
        typeof handleMembresiaDelete
      >;
      mockDelete.mockRejectedValueOnce(
        Object.assign(new Error("DELETE_BLOCKED_ASSIGNED: 5 socios"), {
          code: "DELETE_BLOCKED_ASSIGNED",
        })
      );

      const res = await delMembresia(jsonReq(undefined), ctx);

      expect(res.status).toBe(409);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });
});
