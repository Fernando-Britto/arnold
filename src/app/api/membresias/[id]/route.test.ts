/**
 * Integration tests for GET/PUT/DELETE /api/membresias/[id]
 * T-016: Membresia API layer CRUD
 * 
 * Critical tests for AC-005 (deactivation warning) and AC-006 (delete blocking)
 */

import {
  handleMembresiaGetByIdRequest,
  handleMembresiaUpdateRequest,
  handleMembresiaDeleteRequest,
} from "./route";
import {
  handleMembresiaGetById,
  handleMembresiaUpdate,
  handleMembresiaDelete,
} from "@/api/membresias";

// Mock the API layer
jest.mock("@/api/membresias");
jest.mock("@/lib/db");

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

      expect((result as any).status).toBe(200);
      expect((result as any).id).toBe("1");
      expect((result as any).nombre).toBe("Gold");
      expect((result as any).assignedSocioCount).toBe(5);
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

        expect((result as any).status).toBe(200);
        expect((result as any).estado).toBe("INACTIVA");
        expect((result as any).assignedSocioCount).toBe(5);
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

        expect((result2 as any).status).toBe(200);
        expect((result2 as any).estado).toBe("INACTIVA");
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

      expect((result as any).status).toBe(200);
      expect((result as any).nombre).toBe("Platinum");
      expect((result as any).precio).toBe(25000);
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

        expect((result as any).status).toBe(204);
        expect((result as any).message).toBeDefined();
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
});
