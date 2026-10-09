import { createEjercicio, validateEjercicio, EjercicioRepository } from "./ejercicio";

// Prisma simulado en memoria (FX-16, P-19): este test NO debe tocar la base real. Antes cada corrida
// creaba ejercicios en la base de desarrollo y el primer test dependía de la latencia de la conexión.
jest.mock("@/lib/db", () => {
  type Datos = Record<string, unknown> & { nombre: string; grupoMuscular: string };
  type Fila = Datos & { id: string };
  const filas = new Map<string, Fila>();
  let contador = 0;
  const noExiste = () => Object.assign(new Error("Record does not exist"), { code: "P2025" });

  const ejercicio = {
    create: async ({ data }: { data: Datos }) => {
      const fila: Fila = { id: `ej-${++contador}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      filas.set(fila.id, fila);
      return fila;
    },
    findUnique: async ({ where }: { where: { id: string } }) => filas.get(where.id) ?? null,
    findMany: async ({
      where = {},
    }: { where?: { grupoMuscular?: string; nombre?: { contains: string } } } = {}) =>
      [...filas.values()]
        .filter((f) => !where.grupoMuscular || f.grupoMuscular === where.grupoMuscular)
        .filter((f) => !where.nombre || f.nombre.toLowerCase().includes(where.nombre.contains.toLowerCase()))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    update: async ({ where, data }: { where: { id: string }; data: Partial<Fila> }) => {
      const actual = filas.get(where.id);
      if (!actual) throw noExiste();
      const nueva = { ...actual, ...data, updatedAt: new Date() };
      filas.set(where.id, nueva);
      return nueva;
    },
    delete: jest.fn(async ({ where }: { where: { id: string } }) => {
      if (!filas.delete(where.id)) throw noExiste();
      return {};
    }),
  };
  return { prisma: { ejercicio } };
});

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

    it("should reject nombre with only whitespace", () => {
      const validation = validateEjercicio({
        nombre: "   ",
        grupoMuscular: "Pecho",
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

    it("should throw DELETE_BLOCKED_ASSIGNED when ejercicio is in use (P2003)", async () => {
      // Prueba la traducción del repositorio ante el error de clave foránea que lanzaría Prisma.
      // Que la base realmente lo lance es cosa de un test de integración (P-25).
      const { prisma } = jest.requireMock("@/lib/db");
      const created = await repository.create({ nombre: "Remo con barra", grupoMuscular: "Espalda" });
      prisma.ejercicio.delete.mockRejectedValueOnce({
        code: "P2003",
        message: "Foreign key constraint failed on the field: `ejercicioId`",
      });

      await expect(repository.delete(created.id)).rejects.toMatchObject({
        code: "DELETE_BLOCKED_ASSIGNED",
      });
    });

    it("should return false when deleting a non-existent ejercicio", async () => {
      await expect(repository.delete("non-existent-id")).resolves.toBe(false);
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

    it("should reject update when new nombre is invalid", async () => {
      const created = await repository.create({
        nombre: "Press Militar",
        grupoMuscular: "Hombros",
      });

      await expect(
        repository.update(created.id, { nombre: "ab" })
      ).rejects.toThrow("al menos 3 caracteres");
    });

    it("should reject update when updating only descripcion exceeding 500 chars", async () => {
      const created = await repository.create({
        nombre: "Sentadilla",
        grupoMuscular: "Piernas",
      });

      await expect(
        repository.update(created.id, { descripcion: "d".repeat(501) })
      ).rejects.toThrow("no puede exceder 500 caracteres");
    });
   });
});
