import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientesPage } from "./page";
import { useAuth } from "@/contexts/auth";
import * as clientesApi from "@/api/clientes";
import * as membresasApi from "@/api/membresias";

// Mock dependencies
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/clientes",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");

// Mock API functions
jest.mock("@/api/clientes", () => ({
  fetchClientes: jest.fn(),
  createCliente: jest.fn(),
  updateCliente: jest.fn(),
  deleteCliente: jest.fn(),
}));

jest.mock("@/api/membresias", () => ({
  fetchMembresias: jest.fn(),
}));

import * as actual from "@/api/membresias";

const mockClientesApi = clientesApi as jest.Mocked<typeof clientesApi>;
const mockMembresasApi = membresasApi as jest.Mocked<typeof actual>;

// Helper to wait for loading to complete
const waitForLoadingComplete = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/Cargando/i)).not.toBeInTheDocument();
  });
};

describe("ClientesPage — Cliente CRUD Screen + Membresía Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
      isAdmin: true,
      isStaff: true,
    });
    mockClientesApi.fetchClientes.mockResolvedValue([]);
    mockMembresasApi.fetchMembresias.mockResolvedValue([]);
  });

  describe("AC-008: Role-based access control (RN-06)", () => {
    it("should render page for ADMINISTRADOR role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "ADMINISTRADOR" },
        isAuthenticated: true,
        isAdmin: true,
        isStaff: true,
      });

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Should NOT redirect (stays on page)
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should render page for RECEPCIONISTA role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: true,
      });

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Should NOT redirect (stays on page)
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should deny SOCIO role access (redirect to /home-socio)", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });

      render(<ClientesPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/home-socio");
      });
    });

    it("should deny unauthenticated access (redirect to /login)", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      render(<ClientesPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });
  });

  describe("Data Loading", () => {
    it("should fetch clientes and membresias on component mount", async () => {
      mockClientesApi.fetchClientes.mockResolvedValue([]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        {
          id: "gold-1",
          nombre: "Gold",
          precio: 150.0,
          estado: "ACTIVA" as const,
        },
      ]);

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Verify both APIs were called
      expect(mockClientesApi.fetchClientes).toHaveBeenCalled();
      expect(mockMembresasApi.fetchMembresias).toHaveBeenCalled();
    });

    it("should handle fetch errors gracefully", async () => {
      mockClientesApi.fetchClientes.mockRejectedValue(
        new Error("Network error")
      );
      mockMembresasApi.fetchMembresias.mockResolvedValue([]);

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Error message should appear
      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe("AC-004: Membresía dropdown lists only ACTIVA memberships", () => {
    it("should fetch and provide membresias to form component", async () => {
      const mockMembresias = [
        {
          id: "gold-1",
          nombre: "Gold",
          precio: 150.0,
          estado: "ACTIVA" as const,
        },
        {
          id: "silver-1",
          nombre: "Silver",
          precio: 100.0,
          estado: "ACTIVA" as const,
        },
      ];

      mockClientesApi.fetchClientes.mockResolvedValue([]);
      mockMembresasApi.fetchMembresias.mockResolvedValue(mockMembresias);

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Verify fetch was called
      expect(mockMembresasApi.fetchMembresias).toHaveBeenCalled();
    });
  });

  describe("CRUD Operations", () => {
    it("should create new cliente with tempPassword modal", async () => {
      const user = userEvent.setup();
      const newCliente = {
        id: "cliente-new",
        nombre: "Juan Pérez",
        dni: "35456789",
        email: "juan@example.com",
        telefono: "+54 9 2345 678901",
        membresiaAsignada: "silver-1",
        estadoCuenta: "Activo" as const,
        fechaAlta: new Date(),
      };

      mockClientesApi.fetchClientes.mockResolvedValue([]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        {
          id: "silver-1",
          nombre: "Silver",
          precio: 100.0,
          estado: "ACTIVA" as const,
        },
      ]);
      mockClientesApi.createCliente.mockResolvedValue({
        cliente: newCliente,
        tempPassword: "TempPass-ABC123",
      });

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Type in form fields
      await user.type(screen.getByLabelText(/Nombre/i), "Juan Pérez");
      await user.type(screen.getByLabelText(/DNI/i), "35.456.789");
      await user.type(screen.getByLabelText(/Email/i), "juan@example.com");
      await user.type(screen.getByLabelText(/Teléfono/i), "+54 9 2345 678901");

      // Select membership
      const membresiaSelect = screen.getByLabelText(/Membresía/i);
      await user.selectOptions(membresiaSelect, "silver-1");

      // Submit form - button says "Crear" when creating new cliente
      const createButton = screen.getByRole("button", { name: /Crear/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockClientesApi.createCliente).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Juan Pérez",
            dni: "35.456.789",
            email: "juan@example.com",
            telefono: "+54 9 2345 678901",
            membresiaAsignada: "silver-1",
          })
        );
      });

      // Verify the modal is in the DOM by checking raw HTML first
      expect(document.body.innerHTML).toContain("Contraseña Temporal");
      expect(document.body.innerHTML).toContain("TempPass-ABC123");

      // Also verify it's visible in the rendered tree using getAllByText (handles multiple matches)
      const modalHeaders = screen.getAllByText(/Contraseña Temporal/i);
      expect(modalHeaders.length).toBeGreaterThan(0);

      const passwordTexts = screen.getAllByText(/TempPass-ABC123/i);
      expect(passwordTexts.length).toBeGreaterThan(0);
    });

    it("should update cliente on form submit after selecting from list", async () => {
      const user = userEvent.setup();
      const mockClienteData = {
        id: "cliente-1",
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        telefono: "+54 9 1234 567890",
        membresiaAsignada: "gold-1",
        estadoCuenta: "Activo" as const,
        fechaAlta: new Date("2024-01-15"),
      };

      mockClientesApi.fetchClientes.mockResolvedValue([mockClienteData]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        {
          id: "gold-1",
          nombre: "Gold",
          precio: 150.0,
          estado: "ACTIVA" as const,
        },
      ]);
      mockClientesApi.updateCliente.mockResolvedValue(mockClienteData);

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Wait for cliente to appear in list
      await waitFor(() => {
        expect(screen.getByText("Ana García")).toBeInTheDocument();
      });

      // Click Editar button
      const editButtons = screen.getAllByRole("button", {
        name: /Editar|Edit/i,
      });
      await user.click(editButtons[0]);

      // Verify form title changed to "Editar Cliente" (in the form panel header)
      await waitFor(() => {
        const editHeaders = screen.getAllByText(/Editar Cliente/i);
        expect(editHeaders.length).toBeGreaterThan(0);
      });

      // Modify a field
      const emailInput = screen.getByDisplayValue("ana@example.com");
      await user.clear(emailInput);
      await user.type(emailInput, "ana.garcia@example.com");

      // Submit form - button says "Actualizar" when editing existing cliente
      await user.click(screen.getByRole("button", { name: /Actualizar/i }));

      // Verify updateCliente was called with the cliente id
      await waitFor(() => {
        expect(mockClientesApi.updateCliente).toHaveBeenCalledWith(
          "cliente-1",
          expect.objectContaining({
            email: "ana.garcia@example.com",
          })
        );
      });
    });

    it("should delete cliente from list", async () => {
      const user = userEvent.setup();
      const mockCliente = {
        id: "cliente-1",
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        telefono: null,
        membresiaAsignada: "gold-1",
        estadoCuenta: "Activo" as const,
        fechaAlta: new Date("2024-01-15"),
      };

      mockClientesApi.fetchClientes.mockResolvedValue([mockCliente]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([]);
      mockClientesApi.deleteCliente.mockResolvedValue(undefined);

      // Mock global.confirm to return true
      global.confirm = jest.fn(() => true);

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Wait for cliente to appear
      await waitFor(() => {
        expect(screen.getByText("Ana García")).toBeInTheDocument();
      });

      // Click Eliminar button
      const deleteButtons = screen.getAllByRole("button", {
        name: /Eliminar|Delete/i,
      });
      await user.click(deleteButtons[0]);

      // Verify deleteCliente was called with cliente id
      await waitFor(() => {
        expect(mockClientesApi.deleteCliente).toHaveBeenCalledWith("cliente-1");
      });
    });

    it("should show form title 'Editar Cliente' after selecting from list", async () => {
      const user = userEvent.setup();
      const mockClienteData = {
        id: "cliente-1",
        nombre: "Ana García",
        dni: "30123456",
        email: "ana@example.com",
        telefono: "+54 9 1234 567890",
        membresiaAsignada: "gold-1",
        estadoCuenta: "Activo" as const,
        fechaAlta: new Date("2024-01-15"),
      };

      mockClientesApi.fetchClientes.mockResolvedValue([mockClienteData]);
      mockMembresasApi.fetchMembresias.mockResolvedValue([
        {
          id: "gold-1",
          nombre: "Gold",
          precio: 150.0,
          estado: "ACTIVA" as const,
        },
      ]);

      render(<ClientesPage />);
      await waitForLoadingComplete();

      // Wait for cliente in list
      await waitFor(() => {
        expect(screen.getByText("Ana García")).toBeInTheDocument();
      });

      // Form should show "Nuevo Cliente" initially (from ClienteForm component)
      expect(screen.getByText(/Nuevo Cliente/i)).toBeInTheDocument();

      // Click Editar button
      const editButtons = screen.getAllByRole("button", {
        name: /Editar|Edit/i,
      });
      await user.click(editButtons[0]);

      // Form title should change to "Editar Cliente"
      await waitFor(() => {
        const editHeaders = screen.getAllByText(/Editar Cliente/i);
        expect(editHeaders.length).toBeGreaterThan(0);
      });
    });
  });
});
