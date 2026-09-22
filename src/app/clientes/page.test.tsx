import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
});
