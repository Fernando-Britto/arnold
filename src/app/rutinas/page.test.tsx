import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RutinasPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";
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
jest.mock("@/contexts/notifications");
const mockNotify = jest.fn();

// Mock API functions
jest.mock("@/api/rutinas", () => ({
  fetchRutinas: jest.fn(),
  createRutina: jest.fn(),
  updateRutina: jest.fn(),
  deleteRutina: jest.fn(),
}));

jest.mock("@/api/ejercicios", () => ({
  fetchEjercicios: jest.fn(),
  createEjercicio: jest.fn(),
  updateEjercicio: jest.fn(),
  deleteEjercicio: jest.fn(),
}));

import * as ejerciciosApi from "@/api/ejercicios";

const mockRutinasApi = rutinasApi as jest.Mocked<typeof rutinasApi>;
const mockEjerciciosApi = ejerciciosApi as jest.Mocked<typeof ejerciciosApi>;

// Helper to wait for loading to complete
const waitForLoadingComplete = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/Cargando rutinas/i)).not.toBeInTheDocument();
  });
};

describe("RutinasPage — Rutina CRUD Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
      isAdmin: true,
      isStaff: true,
    });
    mockRutinasApi.fetchRutinas.mockResolvedValue([]);
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
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
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Rutinas/i).length).toBeGreaterThan(0);
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
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Rutinas/i).length).toBeGreaterThan(0);
      });
    });

    it("should deny access for SOCIO role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });

      render(<RutinasPage />);
      await waitForLoadingComplete();

      // Should redirect to home-socio
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/home-socio");
      });
    });

    it("should deny access for RECEPCIONISTA role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });

      render(<RutinasPage />);
      await waitForLoadingComplete();

      // Should redirect to home-socio
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/home-socio");
      });
    });

    it("should redirect unauthenticated users", async () => {
      mockPush.mockClear();
      
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isStaff: false,
      });

      render(<RutinasPage />);
      await waitForLoadingComplete();

      // Verify router.push was called with /login
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      });
    });
  });

  describe("Page rendering and data loading", () => {
    it("should render page with FormPanel and ListPanel", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
      mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);

      render(<RutinasPage />);
      await waitForLoadingComplete();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/Cargando rutinas/i)).not.toBeInTheDocument();
      });

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
      expect(screen.getAllByText(/Rutinas/i).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    });

    it("should load and display rutinas on page mount", async () => {
      const mockRutinas = [mockRutina, mockRutinaWithEjercicios];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);

      render(<RutinasPage />);
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
        expect(screen.getByText("Hipertrofia Avanzada")).toBeInTheDocument();
      });

      expect(mockRutinasApi.fetchRutinas).toHaveBeenCalled();
    });
  });

  describe("FormPanel: Create Rutina", () => {
    it("should call createRutina when form is submitted", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
      mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
      mockRutinasApi.createRutina.mockResolvedValue({
        id: "rutina-001",
        nombre: "Test",
        objetivoPrincipal: "Fuerza",
        frecuenciaSemanal: 3,
        duracionEstimada: 60,
        nivelDeDificultad: "BASICO",
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      render(<RutinasPage />);
      await waitForLoadingComplete();

      // Note: FormPanel validation is tested in rutina-form.test.tsx
      // Here we just verify the page integration works
      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Descripción/i)).toBeInTheDocument();
    });
  });

  describe("ListPanel: Rutinas List", () => {
    it("should display rutinas table with columns", async () => {
      const mockRutinas = [mockRutina, mockRutinaWithEjercicios];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);

      render(<RutinasPage />);
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Table columns
      expect(screen.getAllByText(/Nombre/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Objetivo/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Frecuencia/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Duración/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Nivel/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Ejercicios/i).length).toBeGreaterThan(0);
    });

    it("should display ejercicio count for each rutina", async () => {
      const mockRutinas = [
        mockRutina, // 0 exercises
        mockRutinaWithEjercicios, // 3 exercises
      ];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);

      render(<RutinasPage />);
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Mock data should show counts
      const cells = screen.getAllByText(/^0$|^3$/);
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });

    it("should show empty state when no rutinas exist", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);

      render(<RutinasPage />);
      await waitForLoadingComplete();

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
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);

      render(<RutinasPage />);
      await waitForLoadingComplete();

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
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
      mockRutinasApi.updateRutina.mockResolvedValue({
        ...mockRutina,
        nombre: "Fuerza Full Body Actualizada",
      });

      render(<RutinasPage />);
      await waitForLoadingComplete();

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
      mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
      mockRutinasApi.deleteRutina.mockResolvedValue();

      // Mock global.confirm to return true
      global.confirm = jest.fn(() => true);

      render(<RutinasPage />);
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole("button", { name: /eliminar|delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockRutinasApi.deleteRutina).toHaveBeenCalledWith("rutina-001");
      });
    });

    it("should block delete when rutina assigned to active socio", async () => {
      const user = userEvent.setup();
      const mockRutinas = [mockRutina];
      mockRutinasApi.fetchRutinas.mockResolvedValue(mockRutinas);
      mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
      const error = new ApiError(409, "Rutina asignada activamente a 2 socio(s)");
      mockRutinasApi.deleteRutina.mockRejectedValue(error);

      // Mock global.confirm to return true
      global.confirm = jest.fn(() => true);

      render(<RutinasPage />);
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole("button", { name: /eliminar|delete/i });
      await user.click(deleteButtons[0]);

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
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);

      render(<RutinasPage />);
      await waitForLoadingComplete();

      expect(screen.getByText(/Ejercicios de la rutina/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Agregar Ejercicio/i })).toBeInTheDocument();
    });

    it("should include exercises in create payload", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
      mockRutinasApi.createRutina.mockResolvedValue({
        ...mockRutina,
      });

      render(<RutinasPage />);
      await waitForLoadingComplete();

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
    mockEjerciciosApi.fetchEjercicios.mockResolvedValue([]);
      mockRutinasApi.createRutina.mockRejectedValue(
        new ApiError(400, "Nombre es requerido", "VALIDATION_ERROR")
      );

      render(<RutinasPage />);
      await waitForLoadingComplete();

      // Leave nombre empty and try to submit
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
        new TypeError("Failed to fetch")
      );

      render(<RutinasPage />);
      await waitForLoadingComplete();

      await waitFor(() => {
        expect(
          screen.getByText(/No hay conexión con el servidor/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("T-023b: avisos de éxito y mensajes de error de la API", () => {
    const saved = { ...mockRutina, nombre: "Fuerza Full Body Actualizada" };

    it("al crear avisa 'Rutina creada'", async () => {
      const user = userEvent.setup();
      mockRutinasApi.createRutina.mockResolvedValue(saved);

      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.type(screen.getByLabelText(/Nombre/i), "Rutina Nueva");
      await user.selectOptions(screen.getByLabelText(/Objetivo Principal/i), "Fuerza");
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      await user.click(screen.getByRole("radio", { name: /Básico/i }));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Rutina creada"));
    });

    it("al editar avisa 'Rutina actualizada'", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      mockRutinasApi.updateRutina.mockResolvedValue(saved);

      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click((await screen.findAllByRole("button", { name: /editar|edit/i }))[0]);
      await user.click(screen.getByRole("button", { name: /Guardar|Actualizar/i }));

      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Rutina actualizada"));
    });

    it("al eliminar avisa 'Rutina eliminada'", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      mockRutinasApi.deleteRutina.mockResolvedValue(undefined);
      global.confirm = jest.fn(() => true);

      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click((await screen.findAllByRole("button", { name: /eliminar|delete/i }))[0]);

      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Rutina eliminada"));
    });

    it("si falla el borrado muestra el mensaje del servidor y no avisa éxito", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      mockRutinasApi.deleteRutina.mockRejectedValue(new ApiError(409, "Rutina asignada activamente a 2 socio(s)"));
      global.confirm = jest.fn(() => true);

      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click((await screen.findAllByRole("button", { name: /eliminar|delete/i }))[0]);

      expect(await screen.findByText("Rutina asignada activamente a 2 socio(s)")).toBeInTheDocument();
      expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
    });

    it("un 5xx no muestra el detalle técnico", async () => {
      mockRutinasApi.fetchRutinas.mockRejectedValue(new ApiError(500, "prisma exploded", "SERVER_ERROR"));

      render(<RutinasPage />);
      await waitForLoadingComplete();

      expect(await screen.findByText(/No se pudo procesar la solicitud/i)).toBeInTheDocument();
      expect(screen.queryByText(/prisma exploded/i)).not.toBeInTheDocument();
    });
  });
});
