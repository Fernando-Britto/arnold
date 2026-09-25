/**
 * Integration tests for GET/PUT/DELETE /api/ejercicios/[id]
 * Tests the route handlers and error mapping for individual ejercicio operations
 */

import {
  handleEjercicioGetRequest,
  handleEjercicioUpdateRequest,
  handleEjercicioDeleteRequest,
} from "./route";
import {
  handleEjercicioGet,
  handleEjercicioUpdate,
  handleEjercicioDelete,
} from "@/api/ejercicios";

// Mock the API layer
jest.mock("@/api/ejercicios");
jest.mock("@/lib/db");

describe("Ejercicio [id] API Routes", () => {
  const mockEjercicio = {
    id: "1",
    nombre: "Press Militar",
    grupoMuscular: "Hombros",
    descripcion: "Empuje vertical con mancuernas",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/ejercicios/[id]", () => {
    it("should return single ejercicio by id", async () => {
      const mockGet = handleEjercicioGet as jest.MockedFunction<
        typeof handleEjercicioGet
      >;
      mockGet.mockResolvedValue(mockEjercicio);

      const result = await handleEjercicioGetRequest("1");

      expect((result as any).status).toBe(200);
      expect((result as any).id).toBe("1");
      expect((result as any).nombre).toBe("Press Militar");
    });

    it("should return 404 if ejercicio not found", async () => {
      const mockGet = handleEjercicioGet as jest.MockedFunction<
        typeof handleEjercicioGet
      >;
      mockGet.mockResolvedValue(null);

      const result = await handleEjercicioGetRequest("nonexistent");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });

    it("should handle error from ejercicio get", async () => {
      const mockGet = handleEjercicioGet as jest.MockedFunction<
        typeof handleEjercicioGet
      >;
      mockGet.mockRejectedValue(new Error("Database error"));

      const result = await handleEjercicioGetRequest("1");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(500);
      }
    });
  });

  describe("PUT /api/ejercicios/[id]", () => {
    it("should update ejercicio successfully with valid data", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      const updated = {
        ...mockEjercicio,
        nombre: "Press Inclinado",
        grupoMuscular: "Pecho",
      };
      mockUpdate.mockResolvedValue(updated);

      const result = await handleEjercicioUpdateRequest("1", {
        nombre: "Press Inclinado",
        grupoMuscular: "Pecho",
      });

      expect((result as any).status).toBe(200);
      expect((result as any).nombre).toBe("Press Inclinado");
      expect((result as any).grupoMuscular).toBe("Pecho");
    });

    it("should reject if nombre is empty", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      mockUpdate.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El nombre es requerido"),
          {
            code: "VALIDATION_ERROR",
          }
        )
      );

      const result = await handleEjercicioUpdateRequest("1", {
        nombre: "",
        grupoMuscular: "Hombros",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.status).toBe(400);
      }
    });

    it("should reject if grupoMuscular is empty", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      mockUpdate.mockRejectedValue(
        Object.assign(
          new Error("VALIDATION_ERROR: El grupo muscular es requerido"),
          {
            code: "VALIDATION_ERROR",
          }
        )
      );

      const result = await handleEjercicioUpdateRequest("1", {
        nombre: "Press Militar",
        grupoMuscular: "",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.status).toBe(400);
      }
    });

    it("should return 404 if ejercicio not found", async () => {
      const mockUpdate = handleEjercicioUpdate as jest.MockedFunction<
        typeof handleEjercicioUpdate
      >;
      mockUpdate.mockResolvedValue(null); // Repository returns null when not found

      const result = await handleEjercicioUpdateRequest("nonexistent", {
        nombre: "Updated",
      });

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("DELETE /api/ejercicios/[id]", () => {
     it("should delete ejercicio successfully", async () => {
       const mockDelete = handleEjercicioDelete as jest.MockedFunction<
         typeof handleEjercicioDelete
       >;
       mockDelete.mockResolvedValue(true);

       const result = await handleEjercicioDeleteRequest("1");

       expect((result as any).status).toBe(200);
       expect((result as any).message).toBe("Ejercicio eliminado");
     });

    it("should return 404 if ejercicio not found", async () => {
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<
        typeof handleEjercicioDelete
      >;
      mockDelete.mockResolvedValue(false);

      const result = await handleEjercicioDeleteRequest("nonexistent");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(404);
        expect(result.code).toBe("NOT_FOUND");
      }
    });

    it("should return 409 DELETE_BLOCKED_ASSIGNED when ejercicio is in use", async () => {
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<
        typeof handleEjercicioDelete
      >;
      mockDelete.mockRejectedValue(
        Object.assign(
          new Error("DELETE_BLOCKED_ASSIGNED: No se puede eliminar el ejercicio porque está asignado a una o más rutinas"),
          { code: "DELETE_BLOCKED_ASSIGNED" }
        )
      );

      const result = await handleEjercicioDeleteRequest("ej-en-uso");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(409);
        expect(result.code).toBe("DELETE_BLOCKED_ASSIGNED");
      }
    });

    it("should handle error from ejercicio delete", async () => {
      const mockDelete = handleEjercicioDelete as jest.MockedFunction<
        typeof handleEjercicioDelete
      >;
      mockDelete.mockRejectedValue(new Error("Database error"));

      const result = await handleEjercicioDeleteRequest("1");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.status).toBe(500);
      }
    });
  });
});
