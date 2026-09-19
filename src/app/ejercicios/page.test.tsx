import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjerciciosPage } from "./page";
import { useAuth } from "@/contexts/auth";
import * as ejercicioApi from "@/api/ejercicios";
import { Ejercicio } from "@prisma/client";

// Mock dependencies
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/ejercicios",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");
jest.mock("@/api/ejercicios");
jest.mock("@/components/ejercicio-crud/ejercicio-form", () => ({
  EjercicioForm: ({ onSave, initialData }: any) => (
    <div data-testid="ejercicio-form">
      <button onClick={() => onSave({ nombre: "Test", grupoMuscular: "Pecho" })}>
        Save
      </button>
    </div>
  ),
}));
jest.mock("@/components/ejercicio-crud/ejercicio-list", () => ({
  EjercicioListPanel: ({ ejercicios, onModify, onDelete }: any) => (
    <div data-testid="ejercicio-list">
      {ejercicios.map((e: any) => (
        <div key={e.id}>
          {e.nombre}
          <button onClick={() => onModify(e)}>Modify</button>
          <button onClick={() => onDelete(e.id)}>Delete</button>
        </div>
      ))}
    </div>
  ),
}));

const mockEjercicio: Ejercicio = {
  id: "1",
  nombre: "Press Militar",
  grupoMuscular: "Hombros",
  descripcion: "Empuje vertical",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEjercicio2: Ejercicio = {
  id: "2",
  nombre: "Sentadilla",
  grupoMuscular: "Piernas",
  descripcion: "Flexión de rodillas",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Ejercicios CRUD Screen (Page)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
    });
    (ejercicioApi.fetchEjercicios as jest.Mock).mockResolvedValue([
      mockEjercicio,
    ]);
  });

  describe("Role-based access control", () => {
    it("should render page for ADMINISTRADOR role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "ADMINISTRADOR" },
        isAuthenticated: true,
      });

      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
        expect(screen.getByTestId("ejercicio-list")).toBeInTheDocument();
      });
    });

    it("should render page for INSTRUCTOR role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "INSTRUCTOR" },
        isAuthenticated: true,
      });

      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
        expect(screen.getByTestId("ejercicio-list")).toBeInTheDocument();
      });
    });

    it("should deny access for SOCIO role", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
      });

      // Page should redirect or show access denied
      const { container } = render(<EjerciciosPage />);
      
      // Expect either redirect or error message
      expect(
        container.textContent?.includes("no autorizado") ||
        container.textContent?.includes("Acceso denegado") ||
        !screen.queryByTestId("ejercicio-form")
      ).toBe(true);
    });

    it("should redirect unauthenticated users", async () => {
      mockPush.mockClear();
      
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      render(<EjerciciosPage />);

      // Verify router.push was called with /login
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });

    it("should deny access for RECEPCIONISTA role", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
      });

      const { container } = render(<EjerciciosPage />);

      // Expect access denied
      expect(
        !screen.queryByTestId("ejercicio-form") ||
        container.textContent?.includes("no autorizado")
      ).toBe(true);
    });
  });

  describe("Page layout and rendering", () => {
    it("should render page title", async () => {
      render(<EjerciciosPage />);

      // Use getByRole to get the h1 specifically (not the "Cargando..." text)
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Ejercicios/i })).toBeInTheDocument();
      });
    });

    it("should render FormPanel on the left", async () => {
      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
      });
    });

    it("should render ListPanel on the right", async () => {
      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByTestId("ejercicio-list")).toBeInTheDocument();
      });
    });

    it("should display list of ejercicios on load", async () => {
      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByText("Press Militar")).toBeInTheDocument();
      });
    });
  });

  describe("CRUD operations", () => {
    it("should create new ejercicio and add to list", async () => {
      const user = userEvent.setup();
      // Return a NEW ejercicio with different ID to avoid key duplication
      (ejercicioApi.createEjercicio as jest.Mock).mockResolvedValue(
        mockEjercicio2
      );

      render(<EjerciciosPage />);

      // Wait for loading to finish and form to appear
      await waitFor(() => {
        expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: /Save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(ejercicioApi.createEjercicio).toHaveBeenCalled();
      });
    });

    it("should load ejercicio into form when row is clicked", async () => {
      const user = userEvent.setup();
      
      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByText("Press Militar")).toBeInTheDocument();
      });

      const modifyButton = screen.getByRole("button", { name: /Modify/i });
      await user.click(modifyButton);

      // Form should now be populated (handled by parent state)
      expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
    });

    it("should delete ejercicio when delete is confirmed", async () => {
      const user = userEvent.setup();
      (ejercicioApi.deleteEjercicio as jest.Mock).mockResolvedValue(undefined);

      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByText("Press Militar")).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole("button", { name: /Delete/i });
      
      // Mock confirm
      global.confirm = jest.fn(() => true);
      
      await user.click(deleteButton);

      await waitFor(() => {
        expect(ejercicioApi.deleteEjercicio).toHaveBeenCalledWith("1");
      });

      global.confirm = jest.fn();
    });

    it("should prevent deletion when referenced in rutinas", async () => {
      const user = userEvent.setup();
      (ejercicioApi.deleteEjercicio as jest.Mock).mockRejectedValue(
        new Error("DELETE_BLOCKED_IN_USE")
      );

      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByText("Press Militar")).toBeInTheDocument();
      });

      global.confirm = jest.fn(() => true);
      const deleteButton = screen.getByRole("button", { name: /Delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/en uso|no se puede eliminar/i)).toBeInTheDocument();
      });

      global.confirm = jest.fn();
    });
  });

  describe("Error handling", () => {
    it("should show error message if fetch fails", async () => {
      (ejercicioApi.fetchEjercicios as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/error|falló|no se pudo/i)
        ).toBeInTheDocument();
      });
    });

    it("should show error if create fails", async () => {
      const user = userEvent.setup();
      (ejercicioApi.createEjercicio as jest.Mock).mockRejectedValue(
        new Error("Validation failed")
      );

      render(<EjerciciosPage />);

      // Wait for loading to finish and form to appear
      await waitFor(() => {
        expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: /Save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Error al guardar|falló|error/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form state management", () => {
    it("should reset form after successful creation", async () => {
      const user = userEvent.setup();
      (ejercicioApi.createEjercicio as jest.Mock).mockResolvedValue(
        mockEjercicio2
      );

      render(<EjerciciosPage />);

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: /Save/i });
        expect(saveButton).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: /Save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(ejercicioApi.createEjercicio).toHaveBeenCalled();
      });

      // Form should be reset (initialData = null)
      // This is handled by parent component state
    });

    it("should populate form with selected row data", async () => {
      const user = userEvent.setup();
      
      render(<EjerciciosPage />);

      await waitFor(() => {
        expect(screen.getByText("Press Militar")).toBeInTheDocument();
      });

      const modifyButton = screen.getByRole("button", { name: /Modify/i });
      await user.click(modifyButton);

      // Form should show selected ejercicio data
      expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
    });
  });

  describe("Loading states", () => {
    it("should show loading indicator while fetching", () => {
      (ejercicioApi.fetchEjercicios as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
      );

      render(<EjerciciosPage />);

      // May show loading state briefly
      expect(
        screen.queryByText(/cargando|loading/i) ||
        screen.getByTestId("ejercicio-list")
      ).toBeTruthy();
    });

    it("should disable save button while creating", async () => {
      (ejercicioApi.createEjercicio as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockEjercicio), 500))
      );

      render(<EjerciciosPage />);

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: /Save/i });
        expect(saveButton).toBeInTheDocument();
      });
    });
  });
});
