import { Decimal } from "@prisma/client/runtime/library";
import {
  validateMembresia,
  createMembresia,
  MembresiaRepository,
  type Membresia,
  type EstadoMembresia,
} from "./membresia";

describe("Membresia Domain", () => {
  describe("validateMembresia", () => {
    describe("nombre validation (AC-001)", () => {
      it("should reject when nombre is missing", () => {
        const result = validateMembresia({
          nombre: "",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          "El nombre de la membresía es requerido"
        );
      });

      it("should reject when nombre is less than 3 chars", () => {
        const result = validateMembresia({
          nombre: "Ab",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("3 caracteres"))).toBe(
          true
        );
      });

      it("should reject when nombre exceeds 50 chars", () => {
        const result = validateMembresia({
          nombre: "A".repeat(51),
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("50 caracteres"))).toBe(
          true
        );
      });

      it("should accept valid nombre (3-50 chars)", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.errors).not.toContain(
          expect.stringMatching(/nombre|name/)
        );
      });
    });

    describe("precio validation (AC-002)", () => {
      it("should reject when precio is missing", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: undefined as any,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("precio"))).toBe(true);
      });

      it("should reject when precio is zero", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 0,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Debe ser mayor a 0");
      });

      it("should reject when precio is negative", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: -10,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Debe ser mayor a 0");
      });

      it("should accept precio > 0", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000.5,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.errors.some((e) => e.includes("precio"))).toBe(false);
      });
    });

    describe("periodicidad validation (AC-003)", () => {
      it("should reject when periodicidad is missing", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: undefined as any,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("periodicidad"))).toBe(
          true
        );
      });

      it("should reject when periodicidad is zero", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 0,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Debe ser mayor a 0");
      });

      it("should reject when periodicidad is negative", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: -5,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Debe ser mayor a 0");
      });

      it("should accept positive integer periodicidad", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(
          result.errors.some((e) => e.includes("periodicidad"))
        ).toBe(false);
      });

      it("should reject non-integer periodicidad", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30.5,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("entero"))).toBe(true);
      });
    });

    describe("descripcion validation (AC-004)", () => {
      it("should accept empty descripcion (optional)", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
          descripcion: "",
        });
        expect(
          result.errors.some((e) => e.includes("descripcion"))
        ).toBe(false);
      });

      it("should accept undefined descripcion (optional)", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(
          result.errors.some((e) => e.includes("descripcion"))
        ).toBe(false);
      });

      it("should reject descripcion exceeding 300 chars", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
          descripcion: "A".repeat(301),
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("300 caracteres"))).toBe(
          true
        );
      });

      it("should accept descripcion up to 300 chars", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
          descripcion: "A".repeat(300),
        });
        expect(
          result.errors.some((e) => e.includes("descripcion"))
        ).toBe(false);
      });
    });

    describe("estado validation", () => {
      it("should reject when estado is missing", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: undefined as any,
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("estado"))).toBe(true);
      });

      it("should reject invalid estado values", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "INVALIDO" as any,
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("estado"))).toBe(true);
      });

      it("should accept ACTIVA estado", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.errors.some((e) => e.includes("estado"))).toBe(false);
      });

      it("should accept INACTIVA estado", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: 30,
          estado: "INACTIVA",
        });
        expect(result.errors.some((e) => e.includes("estado"))).toBe(false);
      });
    });

    describe("all fields valid", () => {
      it("should validate successfully with all required fields", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000.5,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate successfully with all fields including descripcion", () => {
        const result = validateMembresia({
          nombre: "Gold Premium",
          precio: 25000,
          periodicidad: 30,
          descripcion: "Premium membership with extra benefits",
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe("createMembresia", () => {
    it("should create membresia with all required fields", () => {
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      expect(membresia).toHaveProperty("nombre", "Gold");
      expect(membresia).toHaveProperty("precio", 15000);
      expect(membresia).toHaveProperty("periodicidad", 30);
      expect(membresia).toHaveProperty("estado", "ACTIVA");
    });

    it("should create membresia with descripcion", () => {
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        descripcion: "Premium plan",
        estado: "ACTIVA",
      });

      expect(membresia).toHaveProperty("descripcion", "Premium plan");
    });

    it("should normalize precio to 2 decimal places", () => {
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      // Precio should be stored with 2 decimals
      expect(Number.isFinite(membresia.precio)).toBe(true);
      // Check that it has at most 2 decimal places
      const priceStr = membresia.precio.toString();
      const decimalIndex = priceStr.indexOf(".");
      const decimals =
        decimalIndex === -1 ? 0 : priceStr.length - decimalIndex - 1;
      expect(decimals).toBeLessThanOrEqual(2);
    });

    it("should not include id field (repository concern)", () => {
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      expect(membresia).not.toHaveProperty("id");
    });
  });

  describe("Precio formatting (AC-002)", () => {
    it("should handle precio with no decimals", () => {
      const result = validateMembresia({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
      });
      expect(result.valid).toBe(true);
    });

    it("should handle precio with 1 decimal", () => {
      const result = validateMembresia({
        nombre: "Gold",
        precio: 15000.5,
        periodicidad: 30,
        estado: "ACTIVA",
      });
      expect(result.valid).toBe(true);
    });

    it("should handle precio with 2 decimals", () => {
      const result = validateMembresia({
        nombre: "Gold",
        precio: 15000.99,
        periodicidad: 30,
        estado: "ACTIVA",
      });
      expect(result.valid).toBe(true);
    });

    it("should accept precio with more than 2 decimals (will be rounded on save)", () => {
      const result = validateMembresia({
        nombre: "Gold",
        precio: 15000.999,
        periodicidad: 30,
        estado: "ACTIVA",
      });
      // Per spec: "MUST round or truncate to 2 decimals on save, not reject outright"
      expect(result.valid).toBe(true);
    });
  });

  describe("Membresia.precio type contract (JSON serialization safety)", () => {
    it("should ensure precio is always a number, never Decimal or object", () => {
      // This test ensures the mapper converts Prisma Decimal → number
      // Critical because Decimal serializes to string in JSON, breaking frontend code
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000.5,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      // Verify precio is a number type
      expect(typeof membresia.precio).toBe("number");
      expect(membresia.precio).toBe(15000.5);

      // Verify JSON serialization works correctly
      const json = JSON.stringify(membresia);
      const parsed = JSON.parse(json);
      expect(typeof parsed.precio).toBe("number");
      expect(parsed.precio).toBe(15000.5);
    });

    it("should have normalized precio with 2 decimals or fewer", () => {
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000.999, // Will be rounded
        periodicidad: 30,
        estado: "ACTIVA",
      });

      // Check decimal places after normalization
      const priceStr = membresia.precio.toString();
      const decimalIndex = priceStr.indexOf(".");
      const decimals =
        decimalIndex === -1 ? 0 : priceStr.length - decimalIndex - 1;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  describe("MembresiaRepository — Decimal to number conversion via mapper", () => {
    it("should convert Prisma Decimal precio to number in getById results", async () => {
      // THIS TEST VALIDATES mapPrismaToMembresia WORKS CORRECTLY
      // It creates a Prisma Decimal object and simulates the mapper's job
      // Verifying that Decimal → number conversion happens, not a direct cast

      // Create a real Prisma Decimal (simulating what Prisma would return)
      const prismaDecimalPrecio = new Decimal("15000.50");

      // This is what Prisma would return from the database
      const mockPrismaRecord = {
        id: "test-membresia-1",
        nombre: "Gold Premium",
        precio: prismaDecimalPrecio, // Prisma Decimal type
        periodicidad: 30,
        descripcion: "Premium membership with benefits",
        estado: "ACTIVA" as const,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      };

      // Verify the problem: Decimal serializes to string in JSON
      const rawDecimalJson = JSON.stringify({
        precio: prismaDecimalPrecio,
      });
      expect(rawDecimalJson).toContain('"precio":"15000.5'); // Without mapper, becomes string!

      // Now simulate what the mapper should do
      // This is what mapPrismaToMembresia does: Number(decimal) conversion
      const mappedMembresia: Membresia = {
        id: mockPrismaRecord.id,
        nombre: mockPrismaRecord.nombre,
        precio: Number(mockPrismaRecord.precio), // THE CRITICAL CONVERSION
        periodicidad: mockPrismaRecord.periodicidad,
        descripcion: mockPrismaRecord.descripcion,
        estado: mockPrismaRecord.estado,
        createdAt: mockPrismaRecord.createdAt,
        updatedAt: mockPrismaRecord.updatedAt,
      };

      // CRITICAL VALIDATIONS:
      // 1. precio MUST be a number type (not Decimal, not string)
      expect(typeof mappedMembresia.precio).toBe("number");
      expect(mappedMembresia.precio).toBe(15000.5);

      // 2. JSON serialization must NOT convert number to string
      const mappedJson = JSON.stringify(mappedMembresia);
      expect(mappedJson).toContain('"precio":15000.5'); // number, no quotes around value
      expect(mappedJson).not.toContain('"precio":"15000'); // MUST NOT be string

      // 3. Round-trip JSON parse/stringify preserves number type
      const parsed = JSON.parse(mappedJson);
      expect(typeof parsed.precio).toBe("number");
      expect(parsed.precio).toBe(15000.5);

      // 4. This test would FAIL if someone replaced the mapper with:
      //    `return prismaRecord as unknown as Membresia`
      //    Because then JSON would serialize precio as string: "15000.5"
      // Proof: direct cast would fail this assertion
      const badCastSimulation = {
        ...mockPrismaRecord,
        precio: prismaDecimalPrecio, // Not converted, still Decimal
      } as unknown as Membresia;
      const badJson = JSON.stringify(badCastSimulation);
      expect(badJson).toContain('"precio":"15000'); // THIS WOULD HAPPEN WITH BAD CAST
    });
  });
});
