import { handleEjercicioCreate, handleEjercicioUpdate, handleEjercicioDelete, handleEjercicioList } from "./ejercicios";
import { ejercicioRepository } from "@/domains/ejercicio/ejercicio";

jest.mock("@/domains/ejercicio/ejercicio");

const mockRepository = ejercicioRepository as jest.Mocked<typeof ejercicioRepository>;

describe("Ejercicio API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/ejercicios (create)", () => {
    it("should create a new ejercicio", async () => {
      const requestData = {
        nombre: "Press Militar",
        grupoMuscular: "Hombros",
        descripcion: "Empuje vertical",
      };

      const mockCreated = {
        id: "ejercicio-1",
        ...requestData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(mockCreated);

      const result = await handleEjercicioCreate(requestData);

      expect(result).toEqual(mockCreated);
      expect(mockRepository.create).toHaveBeenCalledWith(requestData);
    });

    it("should reject invalid nombre", async () => {
      const invalidData = {
        nombre: "ab", // Too short
        grupoMuscular: "Hombros",
      };

      mockRepository.create.mockRejectedValue(
        new Error("Validation failed: Nombre must be at least 3 characters")
      );

      await expect(handleEjercicioCreate(invalidData)).rejects.toThrow("Validation failed");
    });

    it("should reject missing grupoMuscular", async () => {
      const invalidData = {
        nombre: "Press",
        grupoMuscular: "",
      };

      mockRepository.create.mockRejectedValue(
        new Error("Validation failed: Grupo muscular is required")
      );

      await expect(handleEjercicioCreate(invalidData)).rejects.toThrow();
    });

    it("should accept ejercicio without descripcion", async () => {
      const data = {
        nombre: "Squat",
        grupoMuscular: "Piernas",
      };

      const mockCreated = {
        id: "ejercicio-2",
        nombre: "Squat",
        grupoMuscular: "Piernas",
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(mockCreated);

      const result = await handleEjercicioCreate(data);

      expect(result).toEqual(mockCreated);
    });
  });

  describe("GET /api/ejercicios (list)", () => {
    it("should return all ejercicios", async () => {
      const mockList = [
        {
          id: "1",
          nombre: "Press",
          grupoMuscular: "Hombros",
          descripcion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          nombre: "Squat",
          grupoMuscular: "Piernas",
          descripcion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getAll.mockResolvedValue(mockList);

      const result = await handleEjercicioList();

      expect(result).toEqual(mockList);
      expect(mockRepository.getAll).toHaveBeenCalled();
    });

    it("should return empty list when no ejercicios exist", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      const result = await handleEjercicioList();

      expect(result).toEqual([]);
    });

    it("should support filtering by muscle group", async () => {
      const mockFiltered = [
        {
          id: "1",
          nombre: "Press",
          grupoMuscular: "Hombros",
          descripcion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getAll.mockResolvedValue(mockFiltered);

      const result = await handleEjercicioList({ muscleGroup: "Hombros" });

      expect(result).toEqual(mockFiltered);
      expect(mockRepository.getAll).toHaveBeenCalledWith({ muscleGroup: "Hombros" });
    });

     it("should support searching by name", async () => {
       const mockSearchResults = [
         {
           id: "1",
           nombre: "Press",
           grupoMuscular: "Hombros",
           descripcion: null,
           createdAt: new Date(),
           updatedAt: new Date(),
         },
       ];

       mockRepository.getAll.mockResolvedValue(mockSearchResults);

       const result = await handleEjercicioList({ search: "Press" });

       expect(result).toEqual(mockSearchResults);
       expect(mockRepository.getAll).toHaveBeenCalledWith({ search: "Press" });
     });

    it("should support filtering by both search and muscle group simultaneously", async () => {
      const mockBoth = [
        {
          id: "1",
          nombre: "Press Militar",
          grupoMuscular: "Hombros",
          descripcion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getAll.mockResolvedValue(mockBoth);

      const result = await handleEjercicioList({
        search: "Press",
        muscleGroup: "Hombros",
      });

      expect(result).toEqual(mockBoth);
      expect(mockRepository.getAll).toHaveBeenCalledWith({
        search: "Press",
        muscleGroup: "Hombros",
      });
    });
   });

  describe("PUT /api/ejercicios/:id (update)", () => {
    it("should update an ejercicio", async () => {
      const id = "ejercicio-1";
      const updateData = {
        descripcion: "Updated description",
      };

      const mockUpdated = {
        id,
        nombre: "Press",
        grupoMuscular: "Hombros",
        descripcion: "Updated description",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.update.mockResolvedValue(mockUpdated);

      const result = await handleEjercicioUpdate(id, updateData);

      expect(result).toEqual(mockUpdated);
      expect(mockRepository.update).toHaveBeenCalledWith(id, updateData);
    });

    it("should return null for non-existent ejercicio", async () => {
      mockRepository.update.mockResolvedValue(null);

      const result = await handleEjercicioUpdate("non-existent", {
        nombre: "New Name",
      });

      expect(result).toBeNull();
    });

    it("should validate updated fields", async () => {
      const id = "ejercicio-1";
      const invalidUpdate = {
        nombre: "ab", // Too short
      };

      mockRepository.update.mockRejectedValue(
        new Error("Validation failed: Nombre must be at least 3 characters")
      );

      await expect(handleEjercicioUpdate(id, invalidUpdate)).rejects.toThrow();
    });
  });

  describe("DELETE /api/ejercicios/:id", () => {
    it("should delete an ejercicio", async () => {
      const id = "ejercicio-1";

      mockRepository.delete.mockResolvedValue(true);

      const result = await handleEjercicioDelete(id);

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith(id);
    });

    it("should return false for non-existent ejercicio", async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await handleEjercicioDelete("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockRepository.create.mockRejectedValue(new Error("Database error"));

      await expect(handleEjercicioCreate({
        nombre: "Press",
        grupoMuscular: "Hombros",
      })).rejects.toThrow("Database error");
    });

    it("should handle concurrent operations", async () => {
      const data1 = { nombre: "Press", grupoMuscular: "Hombros" };
      const data2 = { nombre: "Squat", grupoMuscular: "Piernas" };

      mockRepository.create.mockResolvedValueOnce({
        id: "1",
        ...data1,
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).mockResolvedValueOnce({
        id: "2",
        ...data2,
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const [result1, result2] = await Promise.all([
        handleEjercicioCreate(data1),
        handleEjercicioCreate(data2),
      ]);

      expect(result1.id).toBe("1");
      expect(result2.id).toBe("2");
    });
  });
});
