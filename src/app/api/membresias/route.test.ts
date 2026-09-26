/**
 * Integration tests for GET /api/membresias (list) and POST /api/membresias (create)
 * T-016: Membresia API layer CRUD
 */

import { handleMembresiaListRequest, handleMembresiaCreateRequest } from "./route";
import {
  handleMembresiaList,
  handleMembresiaCreate,
} from "@/api/membresias";

// Mock the API layer
jest.mock("@/api/membresias");
jest.mock("@/lib/db");

describe("Membresia API Routes", () => {
  const mockMembresias = [
    {
      id: "1",
      nombre: "Gold",
      precio: 15000,
      periodicidad: 30,
      descripcion: "Plan Gold",
      estado: "ACTIVA" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedSocioCount: 5,
    },
    {
      id: "2",
      nombre: "Silver",
      precio: 10000,
      periodicidad: 30,
      descripcion: "Plan Silver",
      estado: "ACTIVA" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedSocioCount: 0,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/membresias", () => {
    it("should return list of all membresias with assignedSocioCount", async () => {
      const mockList = handleMembresiaList as jest.MockedFunction<
        typeof handleMembresiaList
      >;
      mockList.mockResolvedValue(mockMembresias);

      const result = await handleMembresiaListRequest();

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2);
        expect(result[0].nombre).toBe("Gold");
        expect(result[0].assignedSocioCount).toBe(5);
        expect(result[1].nombre).toBe("Silver");
        expect(result[1].assignedSocioCount).toBe(0);
      }
    });

    it("should filter to ACTIVA only when activeOnly=true", async () => {
      const mockList = handleMembresiaList as jest.MockedFunction<
        typeof handleMembresiaList
      >;
      // Mock to return only ACTIVA when activeOnly=true
      mockList.mockImplementation(async (options) => {
        const allMembresias = [
          ...mockMembresias,
          {
            id: "3",
            nombre: "Bronze",
            precio: 5000,
            periodicidad: 30,
            descripcion: "Plan Bronze",
            estado: "INACTIVA" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            assignedSocioCount: 0,
          },
        ];
        
        if (options?.activeOnly) {
          return allMembresias.filter((m) => m.estado === "ACTIVA");
        }
        return allMembresias;
      });

      const result = await handleMembresiaListRequest(true); // activeOnly=true

      if (Array.isArray(result)) {
        // Should only have ACTIVA
        const allActiva = result.every((m) => m.estado === "ACTIVA");
        expect(allActiva).toBe(true);
        expect(result.length).toBe(2); // Only 2 ACTIVA, not 3
      }
    });

    it("should handle empty list", async () => {
      const mockList = handleMembresiaList as jest.MockedFunction<
        typeof handleMembresiaList
      >;
      mockList.mockResolvedValue([]);

      const result = await handleMembresiaListRequest();

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(0);
      }
    });
  });

  describe("POST /api/membresias", () => {
    it("should create membresia with valid data and return 201 with 0 assignedSocioCount", async () => {
      const mockCreate = handleMembresiaCreate as jest.MockedFunction<
        typeof handleMembresiaCreate
      >;
      mockCreate.mockResolvedValue({
        id: "new-id",
        nombre: "Platinum",
        precio: 25000,
        periodicidad: 30,
        descripcion: "Premium plan",
        estado: "ACTIVA",
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedSocioCount: 0,
      });

      const result = await handleMembresiaCreateRequest({
        nombre: "Platinum",
        precio: 25000,
        periodicidad: 30,
        descripcion: "Premium plan",
        estado: "ACTIVA",
      });

      expect((result as any).status).toBe(201);
      expect((result as any).id).toBe("new-id");
      expect((result as any).nombre).toBe("Platinum");
      expect((result as any).assignedSocioCount).toBe(0);
    });

    it("should reject nombre < 3 chars with validation error", async () => {
      const mockCreate = handleMembresiaCreate as jest.MockedFunction<
        typeof handleMembresiaCreate
      >;
      mockCreate.mockRejectedValue(
        Object.assign(
          new Error(
            "VALIDATION_ERROR: El nombre debe tener al menos 3 caracteres"
          ),
          {
            code: "VALIDATION_ERROR",
          }
        )
      );

      const result = await handleMembresiaCreateRequest({
        nombre: "Go",
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.status).toBe(400);
      }
    });

    it("should reject precio <= 0 with validation error", async () => {
      const mockCreate = handleMembresiaCreate as jest.MockedFunction<
        typeof handleMembresiaCreate
      >;
      mockCreate.mockRejectedValue(
        Object.assign(new Error("VALIDATION_ERROR: El precio debe ser mayor a 0"), {
          code: "VALIDATION_ERROR",
        })
      );

      const result = await handleMembresiaCreateRequest({
        nombre: "Gold",
        precio: 0,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.status).toBe(400);
      }
    });

    it("should reject periodicidad <= 0 with validation error", async () => {
      const mockCreate = handleMembresiaCreate as jest.MockedFunction<
        typeof handleMembresiaCreate
      >;
      mockCreate.mockRejectedValue(
        Object.assign(
          new Error(
            "VALIDATION_ERROR: La periodicidad debe ser mayor a 0"
          ),
          {
            code: "VALIDATION_ERROR",
          }
        )
      );

      const result = await handleMembresiaCreateRequest({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 0,
        estado: "ACTIVA",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.status).toBe(400);
      }
    });

    it("should accept valid data and return 201", async () => {
      const mockCreate = handleMembresiaCreate as jest.MockedFunction<
        typeof handleMembresiaCreate
      >;
      mockCreate.mockResolvedValue({
        id: "gold-id",
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        descripcion: "Plan Gold",
        estado: "ACTIVA",
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedSocioCount: 0,
      });

      const result = await handleMembresiaCreateRequest({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        descripcion: "Plan Gold",
        estado: "ACTIVA",
      });

      expect((result as any).status).toBe(201);
      expect((result as any).id).toBe("gold-id");
      expect((result as any).nombre).toBe("Gold");
    });
  });
});
