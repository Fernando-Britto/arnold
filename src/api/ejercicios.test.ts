import { handleEjercicioCreate, handleEjercicioUpdate, handleEjercicioDelete, handleEjercicioList, fetchEjerciciosBusqueda } from "./ejercicios";
import { ejercicioRepository } from "@/domains/ejercicio/ejercicio-repositorio";
import { sinCatalogo } from "../../tests/factories/ejercicio";

jest.mock("@/domains/ejercicio/ejercicio-repositorio");

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
        ...sinCatalogo(),
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
        ...sinCatalogo(),
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
          enRutinas: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...sinCatalogo(),
        },
        {
          id: "2",
          nombre: "Squat",
          grupoMuscular: "Piernas",
          descripcion: null,
          enRutinas: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...sinCatalogo(),
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
          enRutinas: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...sinCatalogo(),
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
          enRutinas: 0,
           createdAt: new Date(),
           updatedAt: new Date(),
           ...sinCatalogo(),
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
          enRutinas: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...sinCatalogo(),
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

    // T-054k: el cortocircuito `if (search || muscleGroup)` descartaba la paginación
    // cuando sólo llegaban limit/offset. Ahora las opciones se propagan siempre.
    it("propaga limit/offset aunque no haya search ni muscleGroup", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      await handleEjercicioList({ limit: 20, offset: 40 });

      expect(mockRepository.getAll).toHaveBeenCalledWith({ limit: 20, offset: 40 });
    });

    it("propaga search + muscleGroup + paginación juntos", async () => {
      mockRepository.getAll.mockResolvedValue([]);

      await handleEjercicioList({
        search: "Press",
        muscleGroup: "Hombros",
        limit: 50,
        offset: 50,
      });

      expect(mockRepository.getAll).toHaveBeenCalledWith({
        search: "Press",
        muscleGroup: "Hombros",
        limit: 50,
        offset: 50,
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
        ...sinCatalogo(),
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
        ...sinCatalogo(),
      }).mockResolvedValueOnce({
        id: "2",
        ...data2,
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...sinCatalogo(),
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

describe("fetchEjerciciosBusqueda (lado cliente)", () => {
  const fetchOriginal = global.fetch;

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it("arma la query con search, limit y offset", async () => {
    const filas = [{ id: "e1", nombre: "Press", grupoMuscular: "Pecho", enRutinas: 0 }];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => filas,
    }) as unknown as typeof fetch;

    await expect(
      fetchEjerciciosBusqueda({ search: "triceps", limit: 50, offset: 100 })
    ).resolves.toEqual(filas);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ejercicios?search=triceps&limit=50&offset=100"
    );
  });

  it("no omite los parámetros ausentes", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch;

    await fetchEjerciciosBusqueda({ limit: 50 });

    expect(global.fetch).toHaveBeenCalledWith("/api/ejercicios?limit=50");
  });

  it("no pasa por conCache: dos llamadas pegan al servidor dos veces", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch;

    await fetchEjerciciosBusqueda({ search: "press" });
    await fetchEjerciciosBusqueda({ search: "press" });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("propaga el error con un texto en español", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(fetchEjerciciosBusqueda({ limit: 51 })).rejects.toThrow(
      "No se pudieron buscar los ejercicios"
    );
  });
});
