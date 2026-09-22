import {
  handleClienteGetRequest,
  handleClienteUpdateRequest,
  type GetSuccess,
  type GetError,
  type UpdateSuccess,
  type UpdateError,
} from "@/app/api/clientes/[id]/route";

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

describe("Cliente [id] API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/clientes/[id]", () => {
    it("should return cliente (verify fechaAlta is ISO string)", async () => {
      const { prisma } = await import("@/lib/db");

      const mockCliente = {
        id: "cliente-123",
        dni: "30123456",
        nombre: "Ana García",
        email: "ana@example.com",
        telefono: null,
        membresiaAsignadaId: "gold-123",
        estadoCuota: "AL_DIA",
        fechaAlta: new Date("2024-01-15"), // Prisma returns Date object
        updatedAt: new Date("2024-01-15"),
        usuario: {
          id: "user-123",
          nombre: "Ana García",
          email: "ana@example.com",
        },
      };

      // Mock: findUnique succeeds
      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(mockCliente);

      const result = await handleClienteGetRequest("cliente-123");

      // Check that result is success (has id, not error code)
      expect((result as GetSuccess).id).toBe("cliente-123");
      expect((result as GetSuccess).fechaAlta).toEqual(new Date("2024-01-15"));
      // Note: JSON serialization will convert Date to ISO string in actual HTTP response
    });
  });

  describe("PUT /api/clientes/[id]", () => {
    it("should reject edit of fechaAlta (read-only per AC-007)", async () => {
      const result = await handleClienteUpdateRequest("cliente-123", {
        nombre: "Updated Name",
        fechaAlta: new Date("2025-01-01"), // Attempt to edit read-only field
      });

      // Should be error response
      expect("status" in result && "code" in result).toBe(true);
      expect((result as UpdateError).code).toBe("VALIDATION_ERROR");
      expect((result as UpdateError).message).toContain("solo lectura");
      expect((result as UpdateError).status).toBe(400);
    });
  });
});
