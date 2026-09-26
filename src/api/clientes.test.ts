import {
  handleClienteCreate,
  handleClienteList,
  handleClienteGet,
  handleClienteUpdate,
  handleClienteDelete,
  createCliente,
  fetchClientes,
  updateCliente,
  deleteCliente,
  type ClienteInput,
} from "./clientes";
import { ClienteRepository } from "@/domains/cliente/cliente";

// Mock Prisma (B4 fix: Include membresia and $transaction)
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
      delete: jest.fn(),
    },
    membresia: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((ops) =>
      Array.isArray(ops)
        ? Promise.resolve(ops.map(() => ({})))
        : Promise.resolve(ops({ prisma: {} }))
    ),
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

    it("should reject membership that is not ACTIVA with MEMBERSHIP_NO_LONGER_ACTIVE", async () => {
      const { prisma } = await import("@/lib/db");

      // Mock: DNI doesn't exist, but membership is not ACTIVA
      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.membresia.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "gold-123",
        estado: "INACTIVA",
      });

      try {
        await handleClienteCreate({
          nombre: "Ana García",
          dni: "30.123.456",
          email: "ana@example.com",
          membresiaAsignada: "gold-123",
          estadoCuenta: "Activo",
        });
        fail("Expected error for inactive membership");
      } catch (error) {
        expect((error as Error).message).toContain("MEMBERSHIP_NO_LONGER_ACTIVE");
      }
    });

    it("should successfully create a cliente with tempPassword and status 201", async () => {
      const { prisma } = await import("@/lib/db");

      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.membresia.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "gold-123",
        estado: "ACTIVA",
      });
      (prisma.usuario.create as jest.Mock).mockResolvedValueOnce({
        id: "user-123",
        nombre: "Ana García",
        email: "ana@example.com",
      });
      (prisma.socio.create as jest.Mock).mockResolvedValueOnce({
        id: "cliente-123",
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        membresiaAsignadaId: "gold-123",
        estadoCuota: "AL_DIA",
        usuarioId: "user-123",
        fechaAlta: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        usuario: {
          id: "user-123",
          nombre: "Ana García",
          email: "ana@example.com",
        },
      });

      const result = await handleClienteCreate({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(result.cliente.id).toBe("cliente-123");
      expect(result.tempPassword).toMatch(/^TempPass-/);
    });
  });

  describe("handleClienteList", () => {
    it("should return a list of all clientes mapped from socios", async () => {
      const { prisma } = await import("@/lib/db");

      (prisma.socio.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: "cliente-123",
          nombre: "Ana García",
          dni: "30123456",
          email: "ana@example.com",
          membresiaAsignadaId: "gold-123",
          estadoCuota: "AL_DIA",
          fechaAlta: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          usuario: { nombre: "Ana García", email: "ana@example.com" },
        },
      ]);

      const result = await handleClienteList();

      expect(result).toHaveLength(1);
      expect(result[0].nombre).toBe("Ana García");
      expect(result[0].estadoCuenta).toBe("Activo");
    });
  });

  describe("handleClienteGet", () => {
    it("should retrieve a cliente by ID successfully", async () => {
      const { prisma } = await import("@/lib/db");

      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "cliente-123",
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        membresiaAsignadaId: "gold-123",
        estadoCuota: "AL_DIA",
        fechaAlta: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        usuario: { nombre: "Ana García", email: "ana@example.com" },
      });

      const result = await handleClienteGet("cliente-123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("cliente-123");
      expect(result?.nombre).toBe("Ana García");
    });

    it("should return null if cliente does not exist", async () => {
      const { prisma } = await import("@/lib/db");

      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await handleClienteGet("nonexistent-123");

      expect(result).toBeNull();
    });
  });

  describe("handleClienteUpdate", () => {
    it("should successfully update a cliente with partial fields", async () => {
      const { prisma } = await import("@/lib/db");

      const existingCliente = {
        id: "cliente-123",
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        membresiaAsignadaId: "gold-123",
        estadoCuota: "AL_DIA",
        usuarioId: "user-123",
        fechaAlta: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        usuario: { nombre: "Ana García", email: "ana@example.com" },
      };

      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(existingCliente);
      (prisma.socio.update as jest.Mock).mockResolvedValueOnce({
        ...existingCliente,
        telefono: "+54 9 1234 567890",
      });

      const result = await handleClienteUpdate("cliente-123", {
        telefono: "+54 9 1234 567890",
      });

      expect(result).not.toBeNull();
      expect(result?.telefono).toBe("+54 9 1234 567890");
    });

    it("should reject update if membership is not ACTIVA", async () => {
      const { prisma } = await import("@/lib/db");

      const existingCliente = {
        id: "cliente-123",
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        membresiaAsignadaId: "gold-123",
        estadoCuota: "AL_DIA",
        usuarioId: "user-123",
        fechaAlta: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        usuario: { nombre: "Ana García", email: "ana@example.com" },
      };

      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(existingCliente);
      (prisma.membresia.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "silver-456",
        estado: "INACTIVA",
      });

      try {
        await handleClienteUpdate("cliente-123", {
          membresiaAsignada: "silver-456",
        });
        fail("Expected error for inactive membership");
      } catch (error) {
        expect((error as Error).message).toContain("MEMBERSHIP_NO_LONGER_ACTIVE");
      }
    });
  });

  describe("handleClienteDelete", () => {
    it("should successfully delete a cliente (socio + usuario in transaction)", async () => {
      const { prisma } = await import("@/lib/db");

      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce({
        id: "cliente-123",
        usuarioId: "user-123",
      });

      await handleClienteDelete("cliente-123");

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should throw NOT_FOUND if cliente does not exist", async () => {
      const { prisma } = await import("@/lib/db");

      (prisma.socio.findUnique as jest.Mock).mockResolvedValueOnce(null);

      try {
        await handleClienteDelete("nonexistent-123");
        fail("Expected NOT_FOUND error");
      } catch (error) {
        expect((error as Error).message).toBe("NOT_FOUND");
      }
    });
  });

  describe("createCliente (fetch client)", () => {
    it("should normalize flat API response to { cliente, tempPassword } contract", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "cliente-123",
          nombre: "Ana García",
          dni: "30123456",
          email: "ana@example.com",
          membresiaAsignada: "gold-123",
          estadoCuenta: "Activo",
          tempPassword: "TempPass-ABC123",
          status: 201,
        }),
      });

      const result = await createCliente({
        nombre: "Ana García",
        dni: "30.123.456",
        email: "ana@example.com",
        membresiaAsignada: "gold-123",
        estadoCuenta: "Activo",
      });

      expect(result.cliente.nombre).toBe("Ana García");
      expect(result.tempPassword).toBe("TempPass-ABC123");
    });
  });

  describe("fetchClientes (fetch client)", () => {
    it("should fetch all clientes from API", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "cliente-123",
            nombre: "Ana García",
            dni: "30123456",
            email: "ana@example.com",
            membresiaAsignada: "gold-123",
            estadoCuenta: "Activo",
          },
        ],
      });

      const result = await fetchClientes();

      expect(result).toHaveLength(1);
      expect(result[0].nombre).toBe("Ana García");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clientes",
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });
  });

  describe("updateCliente (fetch client)", () => {
    it("should update a cliente via PUT request", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "cliente-123",
          nombre: "Ana García López",
          dni: "30123456",
          email: "ana@example.com",
          membresiaAsignada: "gold-123",
          estadoCuenta: "Activo",
        }),
      });

      const result = await updateCliente("cliente-123", {
        nombre: "Ana García López",
      });

      expect(result.nombre).toBe("Ana García López");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clientes/cliente-123",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("deleteCliente (fetch client)", () => {
    it("should delete a cliente via DELETE request", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
      });

      await deleteCliente("cliente-123");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/clientes/cliente-123",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
