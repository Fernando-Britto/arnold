/**
 * Business logic tests for Membresia API handlers
 * T-016: Tests for AC-005 (deactivation warning) and AC-006 (delete blocking)
 * 
 * Mocks MembresiaRepository and tests the actual decision logic
 * Separate from route tests which test error mapping
 */

import {
  handleMembresiaCreate,
  handleMembresiaList,
  handleMembresiaGetById,
  handleMembresiaUpdate,
  handleMembresiaDelete,
} from "./membresias";
import { MembresiaRepository } from "@/domains/membresia/membresia";

// Mock the entire domain module to control both repository and validation
jest.mock("@/domains/membresia/membresia", () => {
  const actual = jest.requireActual("@/domains/membresia/membresia");
  return {
    ...actual,
    MembresiaRepository: jest.fn(),
  };
});

const MockedRepository = MembresiaRepository as jest.MockedClass<
  typeof MembresiaRepository
>;

describe("Membresia Business Logic", () => {
  const mockMembresia: any = {
    id: "1",
    nombre: "Gold",
    precio: 15000,
    periodicidad: 30,
    descripcion: "Plan Gold",
    estado: "ACTIVA",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleMembresiaList", () => {
    it("should return list of membresias with assignedSocioCount", async () => {
      const mockList = [mockMembresia];
      MockedRepository.prototype.getAll = jest
        .fn()
        .mockResolvedValue(mockList);
      MockedRepository.prototype.getAssignedSocioCount = jest
        .fn()
        .mockResolvedValue(5);

      const result = await handleMembresiaList();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should call getAllActivas when activeOnly option is true", async () => {
      const mockList = [mockMembresia];
      MockedRepository.prototype.getAllActivas = jest
        .fn()
        .mockResolvedValue(mockList);
      MockedRepository.prototype.getAssignedSocioCount = jest
        .fn()
        .mockResolvedValue(2);

      const result = await handleMembresiaList({ activeOnly: true });

      expect(MockedRepository.prototype.getAllActivas).toHaveBeenCalled();
      expect(MockedRepository.prototype.getAll).not.toHaveBeenCalled();
      expect(result[0].assignedSocioCount).toBe(2);
    });
  });

  describe("handleMembresiaCreate", () => {
    it("should create membresia with valid data and initialize assignedSocioCount to 0", async () => {
      const created = { ...mockMembresia, id: "new-id" };
      MockedRepository.prototype.create = jest.fn().mockResolvedValue(created);
      MockedRepository.prototype.getAssignedSocioCount = jest
        .fn()
        .mockResolvedValue(0);

      const result = await handleMembresiaCreate({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        descripcion: "Plan Gold",
        estado: "ACTIVA",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("new-id");
      expect(result.assignedSocioCount).toBe(0);
    });

    it("should reject if nombre < 3 chars", async () => {
      try {
        await handleMembresiaCreate({
          nombre: "Go",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        fail("Expected validation error");
      } catch (error) {
        expect((error as Error).message).toContain("nombre");
      }
    });

    it("should reject if precio <= 0", async () => {
      try {
        await handleMembresiaCreate({
          nombre: "Gold",
          precio: 0,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        fail("Expected validation error");
      } catch (error) {
        expect((error as Error).message).toContain("precio");
      }
    });

    it("should reject if periodicidad <= 0", async () => {
      try {
        await handleMembresiaCreate({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 0,
          estado: "ACTIVA",
        });
        fail("Expected validation error");
      } catch (error) {
        expect((error as Error).message).toContain("periodicidad");
      }
    });
  });

  describe("handleMembresiaGetById", () => {
    it("should return membresia with assignedSocioCount", async () => {
      MockedRepository.prototype.getById = jest
        .fn()
        .mockResolvedValue(mockMembresia);
      MockedRepository.prototype.getAssignedSocioCount = jest
        .fn()
        .mockResolvedValue(5);

      const result = await handleMembresiaGetById("1");

      expect(result).toBeDefined();
      expect(result.id).toBe("1");
      expect(result.assignedSocioCount).toBe(5);
    });

    it("should throw NOT_FOUND if membresia doesn't exist", async () => {
      MockedRepository.prototype.getById = jest.fn().mockResolvedValue(null);

      try {
        await handleMembresiaGetById("nonexistent");
        fail("Expected NOT_FOUND error");
      } catch (error) {
        expect((error as any).code).toBe("NOT_FOUND");
        expect((error as Error).message).toContain("NOT_FOUND");
      }
    });
  });

  describe("handleMembresiaUpdate", () => {
    describe("AC-005: Deactivation Warning", () => {
      it("should throw DEACTIVATION_WARNING when deactivating (ACTIVA→INACTIVA) with socios assigned and no confirmation", async () => {
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(mockMembresia);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(5);
        MockedRepository.prototype.update = jest.fn();

        try {
          await handleMembresiaUpdate("1", {
            estado: "INACTIVA",
            // No confirmarDesactivacion
          });
          fail("Expected DEACTIVATION_WARNING");
        } catch (error) {
          expect((error as any).code).toBe("DEACTIVATION_WARNING");
          expect((error as Error).message).toContain("DEACTIVATION_WARNING");
          expect((error as Error).message).toContain("5 socios");
          // Should NOT call update
          expect(MockedRepository.prototype.update).not.toHaveBeenCalled();
        }
      });

      it("should allow deactivation when confirmarDesactivacion === true", async () => {
        const deactivated = { ...mockMembresia, estado: "INACTIVA" };
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(mockMembresia);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(5);
        MockedRepository.prototype.update = jest
          .fn()
          .mockResolvedValue(deactivated);

        const result = await handleMembresiaUpdate("1", {
          estado: "INACTIVA",
          confirmarDesactivacion: true,
        });

        expect(result).toBeDefined();
        expect(result.estado).toBe("INACTIVA");
        expect(MockedRepository.prototype.update).toHaveBeenCalled();
      });

      it("should NOT check deactivation warning when state doesn't change (INACTIVA→INACTIVA)", async () => {
        const inactive = { ...mockMembresia, estado: "INACTIVA" };
        const updated = { ...inactive, nombre: "Updated" };
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(inactive);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(0); // Only called once for final count, not for deactivation check
        MockedRepository.prototype.update = jest.fn().mockResolvedValue(updated);

        const result = await handleMembresiaUpdate("1", {
          nombre: "Updated",
          estado: "INACTIVA",
          // No confirmarDesactivacion needed
        });

        expect(result).toBeDefined();
        // getAssignedSocioCount called once for final count, not for deactivation logic check
        expect(MockedRepository.prototype.getAssignedSocioCount).toHaveBeenCalledTimes(1);
        expect(MockedRepository.prototype.update).toHaveBeenCalled();
      });

      it("should NOT check deactivation warning when already ACTIVA→ACTIVA (no change)", async () => {
        const updated = { ...mockMembresia, nombre: "Updated Gold" };
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(mockMembresia);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(3); // Only called once for final count, not for deactivation check
        MockedRepository.prototype.update = jest.fn().mockResolvedValue(updated);

        const result = await handleMembresiaUpdate("1", {
          nombre: "Updated Gold",
          estado: "ACTIVA",
          // No confirmarDesactivacion needed
        });

        expect(result).toBeDefined();
        // getAssignedSocioCount called once for final count, not for deactivation logic check
        expect(MockedRepository.prototype.getAssignedSocioCount).toHaveBeenCalledTimes(1);
        expect(MockedRepository.prototype.update).toHaveBeenCalled();
      });

      it("should allow deactivation without confirmation if NO socios assigned", async () => {
        const deactivated = { ...mockMembresia, estado: "INACTIVA" };
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(mockMembresia);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(0); // No socios
        MockedRepository.prototype.update = jest
          .fn()
          .mockResolvedValue(deactivated);

        const result = await handleMembresiaUpdate("1", {
          estado: "INACTIVA",
          // No confirmarDesactivacion needed when count === 0
        });

        expect(result).toBeDefined();
        expect(result.estado).toBe("INACTIVA");
        expect(MockedRepository.prototype.update).toHaveBeenCalled();
      });
    });

    it("should update membresia successfully with valid data", async () => {
      const updated = {
        ...mockMembresia,
        nombre: "Platinum",
        precio: 25000,
      };
      MockedRepository.prototype.getById = jest
        .fn()
        .mockResolvedValue(mockMembresia);
      MockedRepository.prototype.update = jest
        .fn()
        .mockResolvedValue(updated);
      MockedRepository.prototype.getAssignedSocioCount = jest
        .fn()
        .mockResolvedValue(0);

      const result = await handleMembresiaUpdate("1", {
        nombre: "Platinum",
        precio: 25000,
      });

      expect(result).toBeDefined();
      expect(result.nombre).toBe("Platinum");
      expect(result.precio).toBe(25000);
    });

    it("should throw NOT_FOUND if membresia doesn't exist", async () => {
      MockedRepository.prototype.getById = jest.fn().mockResolvedValue(null);

      try {
        await handleMembresiaUpdate("nonexistent", {
          nombre: "Updated",
        });
        fail("Expected NOT_FOUND error");
      } catch (error) {
        expect((error as any).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("handleMembresiaDelete", () => {
    describe("AC-006: Delete Blocking", () => {
      it("should block deletion with DELETE_BLOCKED_ASSIGNED when socios assigned", async () => {
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(mockMembresia);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(3);
        MockedRepository.prototype.delete = jest.fn();

        try {
          await handleMembresiaDelete("1");
          fail("Expected DELETE_BLOCKED_ASSIGNED");
        } catch (error) {
          expect((error as any).code).toBe("DELETE_BLOCKED_ASSIGNED");
          expect((error as Error).message).toContain("DELETE_BLOCKED_ASSIGNED");
          expect((error as Error).message).toContain("3 socios");
          // Should NOT call delete
          expect(MockedRepository.prototype.delete).not.toHaveBeenCalled();
        }
      });

      it("should delete successfully if NO socios assigned", async () => {
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(mockMembresia);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(0);
        MockedRepository.prototype.delete = jest.fn().mockResolvedValue(undefined);

        await handleMembresiaDelete("1");

        expect(MockedRepository.prototype.delete).toHaveBeenCalledWith("1");
      });

      it("should show correct assigned count in error message", async () => {
        MockedRepository.prototype.getById = jest
          .fn()
          .mockResolvedValue(mockMembresia);
        MockedRepository.prototype.getAssignedSocioCount = jest
          .fn()
          .mockResolvedValue(42);
        MockedRepository.prototype.delete = jest.fn();

        try {
          await handleMembresiaDelete("1");
          fail("Expected DELETE_BLOCKED_ASSIGNED");
        } catch (error) {
          expect((error as Error).message).toContain("42");
        }
      });
    });

    it("should throw NOT_FOUND if membresia doesn't exist", async () => {
      MockedRepository.prototype.getById = jest.fn().mockResolvedValue(null);

      try {
        await handleMembresiaDelete("nonexistent");
        fail("Expected NOT_FOUND error");
      } catch (error) {
        expect((error as any).code).toBe("NOT_FOUND");
      }
    });
  });
});
