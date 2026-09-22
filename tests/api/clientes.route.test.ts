import {
  handleClienteCreateRequest,
  handleClienteListRequest,
  type CreateSuccess,
  type CreateError,
  type ListSuccess,
  type ListError,
} from "@/app/api/clientes/route";

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

describe("Cliente API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/clientes", () => {
    it("should create cliente with fechaAlta auto-set", async () => {
      const { prisma } = await import("@/lib/db");

      const mockUsuario = {
        id: "user-123",
        nombre: "Ana García",
        email: "ana@example.com",
      };

      const mockCliente = {
        id: "cliente-123",
        dni: "30123456",
        nombre: "Ana García",
        email: "ana@example.com",
        telefono: null,
        membresiaAsignadaId: "gold-123",
        estadoCuota: "AL_DIA",
        fechaAlta: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
        usuario: mockUsuario,
      };

      // Mock: no existing DNI
      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Mock: Usuario.create succeeds
      (prisma.usuario.create as jest.Mock).mockResolvedValueOnce(mockUsuario);

      // Mock: Socio.create succeeds
      (prisma.socio.create as jest.Mock).mockResolvedValueOnce(mockCliente);

      const result = await handleClienteCreateRequest({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      // Check that result is success (has status 201 and id)
      expect((result as CreateSuccess).status).toBe(201);
      expect((result as CreateSuccess).id).toBe("cliente-123");
      expect((result as CreateSuccess).fechaAlta).toEqual(new Date("2024-01-15"));
    });
  });

  describe("GET /api/clientes", () => {
    it("should return list with 200", async () => {
      const { prisma } = await import("@/lib/db");

      const mockClientes = [
        {
          id: "cliente-123",
          dni: "30123456",
          nombre: "Ana García",
          email: "ana@example.com",
          telefono: null,
          membresiaAsignadaId: "gold-123",
          estadoCuota: "AL_DIA",
          fechaAlta: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-15"),
          usuario: {
            id: "user-123",
            nombre: "Ana García",
            email: "ana@example.com",
          },
        },
      ];

      // Mock: findMany succeeds
      (prisma.socio.findMany as jest.Mock).mockResolvedValueOnce(mockClientes);

      const result = await handleClienteListRequest();

      // Check that result is success (array, not error)
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect((result as ListSuccess)[0].id).toBe("cliente-123");
    });
  });
});
