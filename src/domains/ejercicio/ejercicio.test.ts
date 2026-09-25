import { createEjercicio, validateEjercicio, EjercicioRepository } from "./ejercicio";

describe("Ejercicio Domain Model", () => {
  describe("Ejercicio creation and validation", () => {
    it("should create an ejercicio with required fields", () => {
      const ejercicio = createEjercicio("Press Militar", "Hombros", "Empuje vertical");

      expect(ejercicio).toBeDefined();
      expect(ejercicio.nombre).toBe("Press Militar");
      expect(ejercicio.grupoMuscular).toBe("Hombros");
      expect(ejercicio.descripcion).toBe("Empuje vertical");
    });

    it("should validate required nombre field", () => {
      const validation = validateEjercicio({
        nombre: "",
        grupoMuscular: "Hombros",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("El nombre es requerido");
    });

    it("should validate minimum nombre length (3 chars)", () => {
      const validation = validateEjercicio({
        nombre: "ab",
        grupoMuscular: "Hombros",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("al menos 3 caracteres");
    });

    it("should validate maximum nombre length (100 chars)", () => {
      const longName = "a".repeat(101);
      const validation = validateEjercicio({
        nombre: longName,
        grupoMuscular: "Hombros",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("no puede exceder 100 caracteres");
    });

    it("should validate required grupoMuscular field", () => {
      const validation = validateEjercicio({
        nombre: "Press",
        grupoMuscular: "",
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("El grupo muscular es requerido");
    });

    it("should validate maximum descripcion length (500 chars)", () => {
      const longDesc = "d".repeat(501);
      const validation = validateEjercicio({
        nombre: "Press",
        grupoMuscular: "Hombros",
        descripcion: longDesc,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("no puede exceder 500 caracteres");
    });

    it("should accept valid ejercicio with all fields", () => {
      const validation = validateEjercicio({
        nombre: "Press Militar",
        grupoMuscular: "Hombros",
        descripcion: "Empuje vertical para deltoides anterior",
      });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should accept valid ejercicio with only required fields", () => {
      const validation = validateEjercicio({
        nombre: "Sentadilla",
        grupoMuscular: "Piernas",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept minimum valid nombre (3 chars)", () => {
      const validation = validateEjercicio({
        nombre: "abs",
        grupoMuscular: "Abdominales",
      });

      expect(validation.valid).toBe(true);
    });

    it("should accept maximum valid nombre (100 chars)", () => {
      const name = "a".repeat(100);
      const validation = validateEjercicio({
        nombre: name,
        grupoMuscular: "Pecho",
      });

      expect(validation.valid).toBe(true);
    });
  });

  describe("Ejercicio Repository", () => {
    let repository: EjercicioRepository;

    beforeEach(() => {
      // Initialize with empty data
      repository = new EjercicioRepository();
    });

    it("should create an ejercicio in repository", async () => {
      const data = {
        nombre: "Bench Press",
        grupoMuscular: "Pecho",
        descripcion: "Levantamiento de pecho con barra",
      };

      const created = await repository.create(data);

      expect(created).toBeDefined();
      expect(created.nombre).toBe("Bench Press");
      expect(created.id).toBeDefined();
    });

    it("should retrieve ejercicio by ID", async () => {
      const data = {
        nombre: "Deadlift",
        grupoMuscular: "Espalda",
        descripcion: "Levantamiento de peso muerto",
      };

      const created = await repository.create(data);
      const retrieved = await repository.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.nombre).toBe("Deadlift");
    });

    it("should return null for non-existent ejercicio", async () => {
      const retrieved = await repository.getById("non-existent-id");
      expect(retrieved).toBeNull();
    });

    it("should update an ejercicio", async () => {
      const data = {
        nombre: "Squat",
        grupoMuscular: "Piernas",
      };

      const created = await repository.create(data);
      const updated = await repository.update(created.id, {
        descripcion: "Sentadilla con barra",
      });

      expect(updated).toBeDefined();
      expect(updated?.descripcion).toBe("Sentadilla con barra");
      expect(updated?.nombre).toBe("Squat"); // Unchanged field
    });

    it("should delete an ejercicio", async () => {
      const data = {
        nombre: "Curl",
        grupoMuscular: "Brazos",
      };

      const created = await repository.create(data);
      await repository.delete(created.id);

      const retrieved = await repository.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it("should list all ejercicios", async () => {
      await repository.create({
        nombre: "Push-up",
        grupoMuscular: "Pecho",
      });
      await repository.create({
        nombre: "Pull-up",
        grupoMuscular: "Espalda",
      });

      const list = await repository.getAll();

      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("should return empty list when no ejercicios exist", async () => {
      const emptyRepo = new EjercicioRepository();
      const list = await emptyRepo.getAll();

      expect(Array.isArray(list)).toBe(true);
    });

     it("should reject invalid data on create", async () => {
       const invalidData = {
         nombre: "ab", // Too short
         grupoMuscular: "Pecho",
       };

       await expect(repository.create(invalidData as any)).rejects.toThrow();
     });

     it("should return null when updating non-existent ejercicio with only descripcion change", async () => {
       // This test reproduces the P2025 bug: updating only descripcion on a non-existent ID
       // should return null, not throw a Prisma error
       const result = await repository.update("non-existent-id", {
         descripcion: "Updated description only",
       });

       expect(result).toBeNull();
     });

     it("should return null when updating non-existent ejercicio regardless of fields", async () => {
       // Additional test: verify the fix works for all field combinations
       const resultDescOnly = await repository.update("fake-id-1", {
         descripcion: "Only desc",
       });
       expect(resultDescOnly).toBeNull();

       const resultNombreOnly = await repository.update("fake-id-2", {
         nombre: "New Name",
       });
       expect(resultNombreOnly).toBeNull();

       const resultMultiple = await repository.update("fake-id-3", {
         nombre: "New Name",
         descripcion: "New desc",
       });
       expect(resultMultiple).toBeNull();
     });
   });
});
