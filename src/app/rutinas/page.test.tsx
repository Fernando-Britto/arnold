import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  fetchRutina: jest.fn(),
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

// `fetchRutina` se agrega junto con el fix NF-1; se accede por cast para que este
// test pueda correr (y fallar) contra el código viejo, que todavía no lo exporta.
const mockFetchRutina = (rutinasApi as unknown as { fetchRutina: jest.Mock })
  .fetchRutina;

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
    mockFetchRutina.mockResolvedValue({ ...mockRutina, ejercicios: [] });
  });

  describe("Role-based access control", () => {
    it("should render page for ADMINISTRADOR role", async () => {
      render(<RutinasPage />);
      await waitForLoadingComplete();
      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Rutinas/i).length).toBeGreaterThan(0);
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
      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
    });

    it("should deny access for SOCIO role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });
      render(<RutinasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
    });

    it("should deny access for RECEPCIONISTA role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
        isAdmin: false,
        isStaff: false,
      });
      render(<RutinasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
    });

    it("should redirect unauthenticated users", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isStaff: false,
      });
      render(<RutinasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    });
  });

  describe("Page rendering and data loading", () => {
    it("should render the form fields and the table", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      render(<RutinasPage />);
      await waitForLoadingComplete();

      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Objetivo Principal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Frecuencia Semanal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duración Estimada/i)).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Básico/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Agregar Ejercicio/i })).toBeInTheDocument();
      expect(screen.getByRole("table", { name: "Rutinas" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    });

    it("should load and display rutinas on page mount", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina, mockRutinaWithEjercicios]);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await waitFor(() => {
        expect(screen.getByText("Fuerza Full Body")).toBeInTheDocument();
        expect(screen.getByText("Hipertrofia Avanzada")).toBeInTheDocument();
      });
      expect(mockRutinasApi.fetchRutinas).toHaveBeenCalled();
    });
  });

  describe("ListPanel: Rutinas List", () => {
    it("should display the exact mockup columns", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await screen.findByText("Fuerza Full Body");
      const table = screen.getByRole("table", { name: "Rutinas" });
      expect(within(table).getByText("ID")).toBeInTheDocument();
      expect(within(table).getByText("Nombre")).toBeInTheDocument();
      expect(within(table).getByText("Ejercicios")).toBeInTheDocument();
      expect(within(table).getByText("Frec/Sem")).toBeInTheDocument();
      expect(within(table).getByText("Nivel")).toBeInTheDocument();
      expect(within(table).getByText("Estado")).toBeInTheDocument();
    });

    it("should display ejercicio count for each rutina", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina, mockRutinaWithEjercicios]);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await screen.findByText("Fuerza Full Body");
      const cells = screen.getAllByText(/^0$|^3$/);
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });

    it("should show empty state when no rutinas exist", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([]);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      expect(screen.getByText(/No hay rutinas/i)).toBeInTheDocument();
    });
  });

  describe("Selección + Modificar", () => {
    it("Modificar está deshabilitado sin selección", async () => {
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await screen.findByText("Fuerza Full Body");
      expect(screen.getByRole("button", { name: "Modificar" })).toBeDisabled();
    });

    it("carga la rutina seleccionada en el form", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Fuerza Full Body"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));
      await waitFor(() => {
        expect((screen.getByLabelText(/Nombre/i) as HTMLInputElement).value).toBe("Fuerza Full Body");
        expect((screen.getByLabelText(/Frecuencia Semanal/i) as HTMLInputElement).value).toBe("3");
      });
    });

    it("actualiza la rutina con los cambios", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      mockRutinasApi.updateRutina.mockResolvedValue({
        ...mockRutina,
        nombre: "Fuerza Full Body Actualizada",
      });
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Fuerza Full Body"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));
      // El detalle se carga async: esperar a que el form quede poblado antes de editar.
      await waitFor(() =>
        expect((screen.getByLabelText(/Nombre/i) as HTMLInputElement).value).toBe("Fuerza Full Body"),
      );
      await user.clear(screen.getByLabelText(/Nombre/i));
      await user.type(screen.getByLabelText(/Nombre/i), "Fuerza Full Body Actualizada");
      await user.click(screen.getByRole("button", { name: /Guardar|Actualizar/i }));
      await waitFor(() =>
        expect(mockRutinasApi.updateRutina).toHaveBeenCalledWith(
          "rutina-001",
          expect.objectContaining({ nombre: "Fuerza Full Body Actualizada" }),
        ),
      );
      expect(mockNotify).toHaveBeenCalledWith("success", "Rutina actualizada");
    });
  });

  describe("Selección + Modificar (NF-1: no perder los ejercicios)", () => {
    it("carga el detalle con ejercicios antes de abrir el form y los conserva al guardar", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutinaWithEjercicios]);
      mockFetchRutina.mockResolvedValue({
        ...mockRutinaWithEjercicios,
        ejercicios: [
          {
            ejercicioId: "ej-1",
            ejercicioNombre: "Press Banca",
            series: 3,
            repeticiones: 10,
            descanso: 60,
            orden: 0,
          },
          {
            ejercicioId: "ej-2",
            ejercicioNombre: "Sentadilla",
            series: 4,
            repeticiones: 8,
            descanso: 90,
            orden: 1,
          },
        ],
      });
      mockRutinasApi.updateRutina.mockResolvedValue({ ...mockRutinaWithEjercicios });

      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Hipertrofia Avanzada"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));

      // El form debe abrirse con el detalle completo, no con la fila del listado.
      await waitFor(() =>
        expect(mockFetchRutina).toHaveBeenCalledWith("rutina-002"),
      );
      expect(await screen.findByText("Press Banca")).toBeInTheDocument();
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();

      // Guardar debe reenviar los ejercicios cargados (no un array vacío).
      await user.click(screen.getByRole("button", { name: /Guardar/i }));
      await waitFor(() =>
        expect(mockRutinasApi.updateRutina).toHaveBeenCalledWith(
          "rutina-002",
          expect.objectContaining({
            ejercicios: expect.arrayContaining([
              expect.objectContaining({ ejercicioId: "ej-1" }),
              expect.objectContaining({ ejercicioId: "ej-2" }),
            ]),
          }),
        ),
      );
    });
  });

  describe("Selección + Eliminar", () => {
    it("elimina la rutina seleccionada cuando no está asignada", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      mockRutinasApi.deleteRutina.mockResolvedValue();
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Fuerza Full Body"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      await waitFor(() => expect(mockRutinasApi.deleteRutina).toHaveBeenCalledWith("rutina-001"));
      expect(mockNotify).toHaveBeenCalledWith("success", "Rutina eliminada");
      confirmSpy.mockRestore();
    });

    it("bloquea el borrado cuando la rutina está asignada a un socio activo", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina]);
      mockRutinasApi.deleteRutina.mockRejectedValue(
        new ApiError(409, "Rutina asignada activamente a 2 socio(s)"),
      );
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await user.click(await screen.findByText("Fuerza Full Body"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      expect(await screen.findByText(/Rutina asignada activamente/i)).toBeInTheDocument();
      expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
      confirmSpy.mockRestore();
    });
  });

  describe("Buscar", () => {
    it("filtra la tabla por el término ingresado", async () => {
      const user = userEvent.setup();
      mockRutinasApi.fetchRutinas.mockResolvedValue([mockRutina, mockRutinaWithEjercicios]);
      render(<RutinasPage />);
      await waitForLoadingComplete();
      await screen.findByText("Fuerza Full Body");

      await user.click(screen.getByRole("button", { name: "Buscar" }));
      await user.type(screen.getByLabelText("Buscar rutinas"), "hiper");
      expect(screen.getByText("Hipertrofia Avanzada")).toBeInTheDocument();
      expect(screen.queryByText("Fuerza Full Body")).not.toBeInTheDocument();
    });
  });

  describe("Nested EjercicioEnRutina subsection", () => {
    it("includes exercises in create payload", async () => {
      const user = userEvent.setup();
      mockRutinasApi.createRutina.mockResolvedValue({ ...mockRutina });
      render(<RutinasPage />);
      await waitForLoadingComplete();

      await user.type(screen.getByLabelText(/Nombre/i), "Test");
      await user.selectOptions(screen.getByLabelText(/Objetivo Principal/i), "Fuerza");
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "3");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "60");
      await user.click(screen.getByRole("radio", { name: /Intermedio/i }));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() =>
        expect(mockRutinasApi.createRutina).toHaveBeenCalledWith(
          expect.objectContaining({ ejercicios: expect.any(Array) }),
        ),
      );
    });
  });

  describe("API error handling", () => {
    it("should show error when list fails to load", async () => {
      mockRutinasApi.fetchRutinas.mockRejectedValue(new TypeError("Failed to fetch"));
      render(<RutinasPage />);
      await waitForLoadingComplete();
      expect(await screen.findByText(/No hay conexión con el servidor/i)).toBeInTheDocument();
    });

    it("un 5xx no muestra el detalle técnico", async () => {
      mockRutinasApi.fetchRutinas.mockRejectedValue(
        new ApiError(500, "prisma exploded", "SERVER_ERROR"),
      );
      render(<RutinasPage />);
      await waitForLoadingComplete();
      expect(await screen.findByText(/No se pudo procesar la solicitud/i)).toBeInTheDocument();
      expect(screen.queryByText(/prisma exploded/i)).not.toBeInTheDocument();
    });
  });
});
