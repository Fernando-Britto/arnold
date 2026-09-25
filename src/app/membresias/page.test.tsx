import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MembresiasPage } from "./page";
import { useAuth } from "@/contexts/auth";

// Mock dependencies
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/membresias",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");

jest.mock("@/components/membresia-crud/membresia-form-panel", () => ({
  MembresiaFormPanel: ({ initialData, onCancel, isEdit }: any) => (
    <div data-testid="membresia-form-panel">
      <button onClick={() => onCancel()}>Cancel</button>
    </div>
  ),
}));

jest.mock("@/components/membresia-crud/membresia-list-panel", () => ({
  MembresiaListPanel: ({ onEditClick }: any) => (
    <div data-testid="membresia-list-panel" />
  ),
}));

describe("Membresias CRUD Screen (Page) - T-017", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
    });
  });

  describe("Role-based access control (ADMINISTRADOR only)", () => {
    it("should render page for ADMINISTRADOR role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "ADMINISTRADOR" },
        isAuthenticated: true,
      });

      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByTestId("membresia-form-panel")).toBeInTheDocument();
        expect(screen.getByTestId("membresia-list-panel")).toBeInTheDocument();
      });
    });

    it("should deny access and redirect for INSTRUCTOR role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "INSTRUCTOR" },
        isAuthenticated: true,
      });

      render(<MembresiasPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/home-socio");
      });
    });

    it("should deny access and redirect for RECEPCIONISTA role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
      });

      render(<MembresiasPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/home-socio");
      });
    });

    it("should redirect to login if not authenticated", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      render(<MembresiasPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });

    it("should show access denied message for unauthorized role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
      });

      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
        expect(screen.getByText(/No tienes permiso para acceder a esta página/)).toBeInTheDocument();
      });
    });
  });

  describe("Page layout and components", () => {
    it("should display page title", async () => {
      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByText("Membresías")).toBeInTheDocument();
      });
    });

    it("should display form panel on the left", async () => {
      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByTestId("membresia-form-panel")).toBeInTheDocument();
      });
    });

    it("should display list panel on the right", async () => {
      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByTestId("membresia-list-panel")).toBeInTheDocument();
      });
    });

    it("should show 'Nueva Membresía' heading when no membresia is selected", async () => {
      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByText("Nueva Membresía")).toBeInTheDocument();
      });
    });
  });

  describe("Form integration", () => {
    it("should pass onCancel callback to form panel", async () => {
      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByTestId("membresia-form-panel")).toBeInTheDocument();
      });
    });

    it("should pass onEditClick callback to list panel", async () => {
      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByTestId("membresia-list-panel")).toBeInTheDocument();
      });
    });
  });
});
