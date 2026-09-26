import { createRutina, validateRutina, RutinaRepository } from "./rutina";

let memoryRutinas: any[] = [];

jest.mock("@/lib/db", () => ({
  prisma: {
    rutina: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const item = {
          id: `rutina-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryRutinas.push(item);
        return item;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        return memoryRutinas.find((r) => r.id === where.id) || null;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const index = memoryRutinas.findIndex((r) => r.id === where.id);
        if (index === -1) return null;
        memoryRutinas[index] = { ...memoryRutinas[index], ...data };
        return memoryRutinas[index];
      }),
      delete: jest.fn().mockImplementation(async ({ where }) => {
        const index = memoryRutinas.findIndex((r) => r.id === where.id);
        if (index === -1) return null;
        const [deleted] = memoryRutinas.splice(index, 1);
        return deleted;
      }),
    },
  },
}));

describe("Rutina Domain Model", () => {
  beforeEach(() => {
    memoryRutinas = [];
    jest.clearAllMocks();
  });

  describe("Rutina creation and validation", () => {
    it("should create a rutina with required fields", () => {
      const rutina = createRutina("Full Body", 3, 60, "Intermedio");
      expect(rutina).toBeDefined();
      expect(rutina.nombre).toBe("Full Body");
      expect(rutina.frecuenciaSemanal).toBe(3);
      expect(rutina.duracionEstimada).toBe(60);
      expect(rutina.nivelDeDificultad).toBe("Intermedio");
    });

    it("should validate required nombre", () => {
      const validation = validateRutina({
        nombre: "",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("El nombre es requerido");
    });

    it("should validate nombre minimum length (3 chars)", () => {
      const validation = validateRutina({
        nombre: "ab",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("al menos 3 caracteres");
    });

    it("should validate nombre maximum length (100 chars)", () => {
      const longName = "a".repeat(101);
      const validation = validateRutina({
        nombre: longName,
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("no puede exceder 100 caracteres");
    });

    it("should validate frecuenciaSemanal range (1-7)", () => {
      let validation = validateRutina({
        nombre: "Routine",
        frecuenciaSemanal: 0,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      });
      expect(validation.valid).toBe(false);

      validation = validateRutina({
        nombre: "Routine",
        frecuenciaSemanal: 8,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      });
      expect(validation.valid).toBe(false);
    });

    it("should accept valid frecuenciaSemanal (1-7)", () => {
      for (let freq = 1; freq <= 7; freq++) {
        const validation = validateRutina({
          nombre: "Routine",
          frecuenciaSemanal: freq,
          duracionEstimada: 60,
          nivelDeDificultad: "Básico",
        });
        expect(validation.valid).toBe(true);
      }
    });

    it("should validate duracionEstimada is positive", () => {
      const validation = validateRutina({
        nombre: "Routine",
        frecuenciaSemanal: 3,
        duracionEstimada: 0,
        nivelDeDificultad: "Básico",
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("mayor a 0");
    });

    it("should validate nivelDeDificultad enum and spanish names", () => {
       let validation = validateRutina({
         nombre: "Routine",
         frecuenciaSemanal: 3,
         duracionEstimada: 60,
         nivelDeDificultad: "InvalidLevel",
       });
       expect(validation.valid).toBe(false);

       const validLevels = ["Básico", "Intermedio", "Avanzado", "Básico", "Intermedio", "Avanzado"];
       for (const level of validLevels) {
         validation = validateRutina({
           nombre: "Routine",
           frecuenciaSemanal: 3,
           duracionEstimada: 60,
           nivelDeDificultad: level,
         });
         expect(validation.valid).toBe(true);
       }
     });

    it("should validate descripcion maximum length (500 chars)", () => {
      const validation = validateRutina({
        nombre: "Routine",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
        descripcion: "d".repeat(501),
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("no puede exceder 500 caracteres");
    });

    it("should accept valid rutina with all fields", () => {
      const validation = validateRutina({
        nombre: "Upper Body",
        frecuenciaSemanal: 2,
        duracionEstimada: 90,
        nivelDeDificultad: "Avanzado",
        descripcion: "Advanced upper body workout",
        objetivoPrincipal: "Fuerza",
      });
      expect(validation.valid).toBe(true);
    });
  });

  describe("Rutina Repository", () => {
    let repository: RutinaRepository;

    beforeEach(() => {
      repository = new RutinaRepository();
    });

    it("should create a rutina", async () => {
      const data = {
        nombre: "Push/Pull/Legs",
        frecuenciaSemanal: 3,
        duracionEstimada: 75,
        nivelDeDificultad: "Intermedio",
      };
      const created = await repository.create(data);
      expect(created).toBeDefined();
      expect(created.nombre).toBe("Push/Pull/Legs");
      expect(created.id).toBeDefined();
    });

    it("should retrieve rutina by ID", async () => {
      const data = {
        nombre: "Full Body",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      };
      const created = await repository.create(data);
      const retrieved = await repository.getById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.nombre).toBe("Full Body");
    });

    it("should return null for non-existent rutina", async () => {
      const retrieved = await repository.getById("non-existent");
      expect(retrieved).toBeNull();
    });

    it("should update a rutina", async () => {
      const data = {
        nombre: "Routine",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      };
      const created = await repository.create(data);
      const updated = await repository.update(created.id, {
        duracionEstimada: 75,
      });
      expect(updated).toBeDefined();
      expect(updated?.duracionEstimada).toBe(75);
      expect(updated?.nombre).toBe("Routine");
    });

    it("should delete a rutina", async () => {
      const data = {
        nombre: "Temporary",
        frecuenciaSemanal: 1,
        duracionEstimada: 45,
        nivelDeDificultad: "Básico",
      };
      const created = await repository.create(data);
      await repository.delete(created.id);
      const retrieved = await repository.getById(created.id);
      expect(retrieved).toBeNull();
    });

    it("should reject invalid data on create", async () => {
      const invalidData = {
        nombre: "ab",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "Básico",
      };
      await expect(repository.create(invalidData as any)).rejects.toThrow();
    });
  });
});
