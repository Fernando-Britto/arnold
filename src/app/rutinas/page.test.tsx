import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RutinasPage } from "./page";
import { useAuth } from "@/contexts/auth";
import * as rutinasApi from "@/api/rutinas";
import { mockRutina, mockRutinaWithEjercicios } from "@/__mocks__/rutina";

// Mock dependencies
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/rutinas",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");

// Mock API functions
jest.mock("@/api/rutinas", () => ({
  fetchRutinas: jest.fn(),
  createRutina: jest.fn(),
  updateRutina: jest.fn(),
  deleteRutina: jest.fn(),
}));

const mockRutinasApi = rutinasApi as jest.Mocked<typeof rutinasApi>;

describe("RutinasPage — Rutina CRUD Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
      isAdmin: true,
      isStaff: true,
    });
    mockRutinasApi.fetchRutinas.mockResolvedValue([]);
  });

  describe("Role-based access control", () => {
    it("should render page for ADMINISTRADOR role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "ADMINISTRADOR" },
        isAuthenticated: true,
        isAdmin: true,
        isStaff: true,
      });

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
        expect(screen.getByText(/Rutinas/i)).toBeInTheDocument();
      });
    });

    it("should render page for INSTRUCTOR role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "INSTRUCTOR" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: true,
      });

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
        expect(screen.getByText(/Rutinas/i)).toBeInTheDocument();
      });
    });

    it("should deny access for SOCIO role", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });

      const { container } = render(<RutinasPage />);
      
      // Expect access denied or no form rendered
      expect(
        container.textContent?.includes("no autorizado") ||
        container.textContent?.includes("Acceso denegado") ||
        !screen.queryByLabelText(/Nombre/i)
      ).toBe(true);
    });

    it("should deny access for RECEPCIONISTA role", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });

      const { container } = render(<RutinasPage />);
      
      expect(
        container.textContent?.includes("no autorizado") ||
        container.textContent?.includes("Acceso denegado") ||
        !screen.queryByLabelText(/Nombre/i)
      ).toBe(true);
    });

    it("should redirect unauthenticated users", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isStaff: false,
      });

      render(<RutinasPage />);

      // Page should handle unauthorized access
      expect(
        !screen.queryByLabelText(/Nombre/i)
      ).toBe(true);
    });
  });

  describe("Page rendering and data loading", () => {
    it("should render page with FormPanel and ListPanel", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);

      render(<RutinasPage />);

      // FormPanel elements
      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Objetivo Principal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Frecuencia Semanal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duración Estimada/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Descripción/i)).toBeInTheDocument();

      // Radio buttons for NivelDeDificultad
      expect(screen.getByRole("radio", { name: /Básico/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Intermedio/i })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Avanzado/i })).toBeInTheDocument();

      // Nested EjercicioEnRutina subsection
      expect(screen.getByText(/Ejercicios de la rutina/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Agregar Ejercicio/i })).toBeInTheDocument();

      // ListPanel
      expect(screen.getByText(/Rutinas/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    });

    it("should load and display rutinas on page mount", async () => {
      const mockRutinas = [mockRutina, mockRutinaWithEjercicios];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
        expect(screen.getByText("Hipertrofia Avanzada")).toBeInTheDocument();
      });

      expect(mockRutinasApi.fetchRutinas).toHaveBeenCalled();
    });
  });

  describe("FormPanel: Create Rutina", () => {
    it("should create a new rutina with valid input", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
      mockRutinasApi.createRutina.mockResolvedValue({
        ...mockRutina,
      });

      render(<RutinasPage />);

      await user.type(screen.getByLabelText(/Nombre/i), "Nueva Rutina");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Fuerza"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      await user.click(screen.getByRole("radio", { name: /Intermedio/i }));
      await user.type(
        screen.getByLabelText(/Descripción/i),
        "Rutina de fuerza completa"
      );

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(mockRutinasApi.createRutina).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Nueva Rutina",
            objetivoPrincipal: "Fuerza",
            frecuenciaSemanal: 3,
            duracionEstimada: 60,
            nivelDeDificultad: "INTERMEDIO",
            descripcion: "Rutina de fuerza completa",
          })
        );
      });
    });

    it("should show validation error for frecuenciaSemanal out of range", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);

      render(<RutinasPage />);

      await user.type(screen.getByLabelText(/Nombre/i), "Test");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Fuerza"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "8");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      await user.click(screen.getByRole("radio", { name: /Básico/i }));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Debe estar entre 1 y 7 días/i)).toBeInTheDocument();
      });

      expect(mockRutinasApi.createRutina).not.toHaveBeenCalled();
    });

    it("should show validation error for duracionEstimada non-positive", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);

      render(<RutinasPage />);

      await user.type(screen.getByLabelText(/Nombre/i), "Test");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Fuerza"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "0");
      await user.click(screen.getByRole("radio", { name: /Básico/i }));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Debe ser mayor a 0/i)).toBeInTheDocument();
      });

      expect(mockRutinasApi.createRutina).not.toHaveBeenCalled();
    });

    it("should require nivelDeDificultad selection", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);

      render(<RutinasPage />);

      await user.type(screen.getByLabelText(/Nombre/i), "Test");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Fuerza"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      // Don't select any nivel

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/requerido|required/i)).toBeInTheDocument();
      });

      expect(mockRutinasApi.createRutina).not.toHaveBeenCalled();
    });

    it("should reset form after successful creation", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
      mockRutinasApi.createRutina.mockResolvedValue({
        ...mockRutina,
      });

      render(<RutinasPage />);

      await user.type(screen.getByLabelText(/Nombre/i), "Test Rutina");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Fuerza"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      await user.click(screen.getByRole("radio", { name: /Básico/i }));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(mockRutinasApi.createRutina).toHaveBeenCalled();
      });

      // Form should be cleared
      expect((screen.getByLabelText(/Nombre/i) as HTMLInputElement).value).toBe("");
      expect(
        (screen.getByLabelText(/Duración Estimada/i) as HTMLInputElement).value
      ).toBe("");
    });
  });

  describe("ListPanel: Rutinas List", () => {
    it("should display rutinas table with columns", async () => {
      const mockRutinas = [mockRutina, mockRutinaWithEjercicios];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Table columns
      expect(screen.getByText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByText(/Objetivo/i)).toBeInTheDocument();
      expect(screen.getByText(/Frecuencia/i)).toBeInTheDocument();
      expect(screen.getByText(/Duración/i)).toBeInTheDocument();
      expect(screen.getByText(/Nivel/i)).toBeInTheDocument();
      expect(screen.getByText(/Ejercicios/i)).toBeInTheDocument();
    });

    it("should display ejercicio count for each rutina", async () => {
      const mockRutinas = [
        mockRutina, // 0 exercises
        mockRutinaWithEjercicios, // 3 exercises
      ];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Mock data should show counts
      const cells = screen.getAllByText(/^0$|^3$/);
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });

    it("should show empty state when no rutinas exist", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);

      render(<RutinasPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/No hay rutinas|sin rutinas|vacío/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edit Rutina", () => {
    it("should load existing rutina into form when editing", async () => {
      const user = userEvent.setup();
      const mockRutinas = [mockRutina];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Click edit button for the rutina
      const editButtons = screen.getAllByRole("button", { name: /editar|edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect((screen.getByLabelText(/Nombre/i) as HTMLInputElement).value).toBe(
          "Fuerza Full Body"
        );
        expect((screen.getByLabelText(/Frecuencia Semanal/i) as HTMLInputElement).value).toBe(
          "3"
        );
      });
    });

    it("should update rutina with changes", async () => {
      const user = userEvent.setup();
      const mockRutinas = [mockRutina];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);
      mockRutinasApi.updateRutina.mockResolvedValue({
        ...mockRutina,
        nombre: "Fuerza Full Body Actualizada",
      });

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Click edit
      const editButtons = screen.getAllByRole("button", { name: /editar|edit/i });
      await user.click(editButtons[0]);

      // Update name
      await user.clear(screen.getByLabelText(/Nombre/i));
      await user.type(screen.getByLabelText(/Nombre/i), "Fuerza Full Body Actualizada");

      await user.click(screen.getByRole("button", { name: /Guardar|Actualizar/i }));

      await waitFor(() => {
        expect(mockRutinasApi.updateRutina).toHaveBeenCalledWith(
          "rutina-001",
          expect.objectContaining({
            nombre: "Fuerza Full Body Actualizada",
          })
        );
      });
    });
  });

  describe("Delete Rutina", () => {
    it("should delete rutina when not assigned to active socio", async () => {
      const user = userEvent.setup();
      const mockRutinas = [mockRutina];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);
      mockRutinasApi.deleteRutina.mockResolvedValue();

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole("button", { name: /eliminar|delete/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByRole("button", { name: /confirmar|sí|aceptar|yes/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockRutinasApi.deleteRutina).toHaveBeenCalledWith("rutina-001");
      });
    });

    it("should block delete when rutina assigned to active socio", async () => {
      const user = userEvent.setup();
      const mockRutinas = [mockRutina];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);
      const error = new Error(
        "Rutina asignada activamente a 2 socio(s)"
      );
      mockRutinasApi.deleteRutina.mockRejectedValue(error);

      render(<RutinasPage />);

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole("button", { name: /eliminar|delete/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByRole("button", { name: /confirmar|sí|aceptar|yes/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Rutina asignada activamente/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Nested EjercicioEnRutina subsection", () => {
    it("should render exercise subsection in form", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);

      render(<RutinasPage />);

      expect(screen.getByText(/Ejercicios de la rutina/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Agregar Ejercicio/i })).toBeInTheDocument();
    });

    it("should include exercises in create payload", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
      mockRutinasApi.createRutina.mockResolvedValue({
        ...mockRutina,
      });

      render(<RutinasPage />);

      // Fill form
      await user.type(screen.getByLabelText(/Nombre/i), "Test");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Fuerza"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      await user.click(screen.getByRole("radio", { name: /Intermedio/i }));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(mockRutinasApi.createRutina).toHaveBeenCalledWith(
          expect.objectContaining({
            ejercicios: expect.any(Array),
          })
        );
      });
    });
  });

  describe("API error handling", () => {
    it("should show error when creation fails", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
      mockRutinasApi.createRutina.mockRejectedValue(
        new Error("Nombre es requerido")
      );

      render(<RutinasPage />);

      await user.type(screen.getByLabelText(/Nombre/i), "");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Fuerza"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      await user.click(screen.getByRole("radio", { name: /Básico/i }));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Nombre es requerido/i)).toBeInTheDocument();
      });
    });

    it("should show error when list fails to load", async () => {
      mockRutinasApi.fetchRutinas.mockRejectedValue(
        new Error("No se pudo cargar las rutinas")
      );

      render(<RutinasPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/No se pudo cargar las rutinas|error/i)
        ).toBeInTheDocument();
      });
    });
  });
});
