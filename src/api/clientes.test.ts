import { handleClienteCreate } from "./clientes";
import { ClienteRepository } from "@/domains/cliente/cliente";

// Mock Prisma
jest.mock("@/lib/db", () => ({
  prisma: {
    socio: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    usuario: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("Cliente API Handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleClienteCreate", () => {
    it("should validate required fields (nombre, dni, email, membresiaAsignada)", async () => {
      try {
        await handleClienteCreate({
          nombre: "",
          dni: "30.123.456",
          email: "ana@example.com",
          membresiaAsignada: "gold-123",
          estadoCuenta: "Activo",
        });
        fail("Expected error for empty nombre");
      } catch (error) {
        expect((error as Error).message).toContain("El nombre es requerido");
      }
    });

    it("should reject duplicate DNI with VALIDATION_DUPLICATE_DNI error code", async () => {
      const { prisma } = await import("@/lib/db");

      // Mock: DNI already exists
      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "existing-id",
        dni: "30123456",
      });

      try {
        await handleClienteCreate({
          nombre: "Ana García",
          dni: "30.123.456", // Same DNI
          email: "ana@example.com",
          membresiaAsignada: "gold-123",
          estadoCuenta: "Activo",
        });
        fail("Expected error for duplicate DNI");
      } catch (error) {
        expect((error as Error).message).toBe(
          "VALIDATION_DUPLICATE_DNI: DNI ya registrado"
        );
      }
    });
  });
});
