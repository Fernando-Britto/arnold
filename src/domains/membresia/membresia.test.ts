import { Decimal } from "@prisma/client/runtime/library";
import {
  validateMembresia,
  createMembresia,
  MembresiaRepository,
  mapPrismaToMembresia,
  type Membresia,
  type EstadoMembresia,
} from "./membresia";

// The repository resolves Prisma through a dynamic import; mock it so we can
// assert the exact value that would be persisted.
jest.mock("@/lib/db", () => ({
  prisma: {
    membresia: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    socio: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

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

      it("should reject when nombre contains only whitespace", () => {
        const result = validateMembresia({
          nombre: "     ",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("El nombre de la membresía es requerido");
      });

      it("should reject when nombre with padding has fewer than 3 actual characters", () => {
        const result = validateMembresia({
          nombre: "   Go   ",
          precio: 15000,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("3 caracteres"))).toBe(true);
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
        expect(result.errors).toContain("El precio debe ser mayor a 0");
      });

      it("should reject when precio is negative", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: -10,
          periodicidad: 30,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("El precio debe ser mayor a 0");
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
        expect(result.errors).toContain("La periodicidad debe ser mayor a 0");
      });

      it("should reject when periodicidad is negative", () => {
        const result = validateMembresia({
          nombre: "Gold",
          precio: 15000,
          periodicidad: -5,
          estado: "ACTIVA",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("La periodicidad debe ser mayor a 0");
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

    it("should normalize precio to a whole integer (no cents)", () => {
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000,
        periodicidad: 30,
        estado: "ACTIVA",
      });

      // Prices in Argentina have no cents: precio must be a whole number.
      expect(Number.isInteger(membresia.precio)).toBe(true);
      expect(membresia.precio).toBe(15000);
    });

    it("should round precio to the nearest integer on save", () => {
      expect(
        createMembresia({ nombre: "Gold", precio: 15000.5, periodicidad: 30, estado: "ACTIVA" }).precio
      ).toBe(15001);
      expect(
        createMembresia({ nombre: "Gold", precio: 15000.4, periodicidad: 30, estado: "ACTIVA" }).precio
      ).toBe(15000);
      expect(
        createMembresia({ nombre: "Gold", precio: 15000.6, periodicidad: 30, estado: "ACTIVA" }).precio
      ).toBe(15001);
    });

    it("should keep precio > 0 after rounding (tiny positives clamp to 1)", () => {
      expect(
        createMembresia({ nombre: "Gold", precio: 0.4, periodicidad: 30, estado: "ACTIVA" }).precio
      ).toBe(1);
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

    it("should trim nombre and convert whitespace-only descripcion to null", () => {
      const membresia = createMembresia({
        nombre: "  Gold Plan  ",
        precio: 15000,
        periodicidad: 30,
        descripcion: "   ",
        estado: "ACTIVA",
      });

      expect(membresia.nombre).toBe("Gold Plan");
      expect(membresia.descripcion).toBeNull();
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
      expect(membresia.precio).toBe(15001);

      // Verify JSON serialization works correctly
      const json = JSON.stringify(membresia);
      const parsed = JSON.parse(json);
      expect(typeof parsed.precio).toBe("number");
      expect(parsed.precio).toBe(15001);
    });

    it("should have normalized precio as a whole integer", () => {
      const membresia = createMembresia({
        nombre: "Gold",
        precio: 15000.999, // Will be rounded to the nearest integer
        periodicidad: 30,
        estado: "ACTIVA",
      });

      expect(Number.isInteger(membresia.precio)).toBe(true);
      expect(membresia.precio).toBe(15001);
    });
  });

  describe("mapPrismaToMembresia — Decimal to number conversion", () => {
    it("should convert Prisma Decimal precio to number type", () => {
      // THIS TEST CALLS THE REAL mapPrismaToMembresia FUNCTION
      // If someone breaks the mapper, this test fails immediately

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

      // CALL THE REAL MAPPER FUNCTION
      const result = mapPrismaToMembresia(mockPrismaRecord);

      // CRITICAL VALIDATIONS ON THE REAL FUNCTION:
      // 1. precio MUST be a number type (not Decimal, not string)
      expect(typeof result.precio).toBe("number");
      expect(result.precio).toBe(15000.5);

      // 2. JSON serialization must NOT convert number to string
      const resultJson = JSON.stringify(result);
      expect(resultJson).toContain('"precio":15000.5'); // number, no quotes around value
      expect(resultJson).not.toContain('"precio":"15000'); // MUST NOT be string

      // 3. Round-trip JSON parse/stringify preserves number type
      const parsed = JSON.parse(resultJson);
      expect(typeof parsed.precio).toBe("number");
      expect(parsed.precio).toBe(15000.5);

      // 4. This test CATCHES if someone replaces the mapper with:
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

describe("MembresiaRepository — precio rounding on persist", () => {
  const prismaRecord = (precio: number) => ({
    id: "m1",
    nombre: "Gold",
    precio,
    periodicidad: 30,
    descripcion: null,
    estado: "ACTIVA" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("persists precio as a whole integer on create (15000.5 → 15001)", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.membresia.create as jest.Mock).mockResolvedValue(prismaRecord(15001));

    await new MembresiaRepository().create({
      nombre: "Gold",
      precio: 15000.5,
      periodicidad: 30,
      estado: "ACTIVA",
    });

    expect(prisma.membresia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ precio: 15001 }),
      })
    );
  });

  it("persists precio as a whole integer on update (15000.5 → 15001)", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.membresia.update as jest.Mock).mockResolvedValue(prismaRecord(15001));

    await new MembresiaRepository().update("m1", { precio: 15000.5 });

    expect(prisma.membresia.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ precio: 15001 }),
      })
    );
  });
});

describe("MembresiaRepository — descripcion opcional (NF-14)", () => {
  const prismaRecord = (descripcion: string | null) => ({
    id: "m1",
    nombre: "Gold",
    precio: 15000,
    periodicidad: 30,
    descripcion,
    estado: "ACTIVA" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("null vacía la descripción (no la deja igual)", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.membresia.update as jest.Mock).mockResolvedValue(prismaRecord(null));

    await new MembresiaRepository().update("m1", { descripcion: null });

    expect(prisma.membresia.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ descripcion: null }) })
    );
  });

  it("omitir la descripción no manda esa clave (mantiene el valor actual)", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.membresia.update as jest.Mock).mockResolvedValue(prismaRecord("Plan Gold"));
    (prisma.membresia.update as jest.Mock).mockClear();

    await new MembresiaRepository().update("m1", { nombre: "Gold Plus" });

    const { data } = (prisma.membresia.update as jest.Mock).mock.calls[0][0];
    expect(data).not.toHaveProperty("descripcion");
  });
});

describe("MembresiaRepository — conteo de socios asignados sin N+1", () => {
  const prismaMembresia = (id: string, socios: number) => ({
    id,
    nombre: id,
    precio: 15000,
    periodicidad: 30,
    descripcion: null,
    estado: "ACTIVA" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { socios },
  });

  it("getAllWithAssignedCounts resuelve todos los conteos con un único findMany (_count)", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.membresia.findMany as jest.Mock).mockResolvedValue([
      prismaMembresia("m1", 3),
      prismaMembresia("m2", 0),
    ]);
    (prisma.socio.count as jest.Mock).mockClear();

    const result = await new MembresiaRepository().getAllWithAssignedCounts();

    expect(prisma.membresia.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.membresia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { _count: { select: { socios: true } } },
      })
    );
    // El conteo por fila ya no debe ejecutarse.
    expect(prisma.socio.count).not.toHaveBeenCalled();
    expect(result.map((m) => m.assignedSocioCount)).toEqual([3, 0]);
    expect(result[0].precio).toBe(15000);
  });

  it("propaga activeOnly como filtro de estado en la misma consulta", async () => {
    const { prisma } = await import("@/lib/db");
    (prisma.membresia.findMany as jest.Mock).mockResolvedValue([]);

    await new MembresiaRepository().getAllWithAssignedCounts(true);

    expect(prisma.membresia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: "ACTIVA" } })
    );
  });
});
