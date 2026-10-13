import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjerciciosPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";
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
jest.mock("@/contexts/notifications");
const mockNotify = jest.fn();
jest.mock("@/api/ejercicios");
jest.mock("@/components/ejercicio-crud/ejercicio-form", () => ({
  EjercicioForm: ({
    onSave,
    initialData,
  }: {
    onSave: (data: {
      id?: string;
      nombre: string;
      grupoMuscular: string;
      descripcion: string;
    }) => void;
    initialData: Ejercicio | null;
  }) => (
    <div data-testid="ejercicio-form">
      <span data-testid="form-nombre">{initialData?.nombre ?? ""}</span>
      <button
        onClick={() =>
          onSave({
            ...(initialData?.id ? { id: initialData.id } : {}),
            nombre: "Test",
            grupoMuscular: "Pecho",
            descripcion: "",
          })
        }
      >
        Save
      </button>
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
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
    });
    (ejercicioApi.fetchEjercicios as jest.Mock).mockResolvedValue([mockEjercicio, mockEjercicio2]);
  });

  describe("Role-based access control", () => {
    it("should render page for ADMINISTRADOR role", async () => {
      render(<EjerciciosPage />);
      await waitFor(() => {
        expect(screen.getByTestId("ejercicio-form")).toBeInTheDocument();
        expect(screen.getByRole("table", { name: "Ejercicios" })).toBeInTheDocument();
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
      });
    });

    it("should deny access for SOCIO role", () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
      });
      render(<EjerciciosPage />);
      expect(screen.queryByTestId("ejercicio-form")).not.toBeInTheDocument();
    });

    it("should redirect unauthenticated users", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isAuthenticated: false });
      render(<EjerciciosPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    });
  });

  describe("Table (mockup alignment)", () => {
    it("renderiza las columnas exactas del spec", async () => {
      render(<EjerciciosPage />);
      await screen.findByText("Press Militar");
      expect(screen.getByText("ID")).toBeInTheDocument();
      expect(screen.getByText("Nombre")).toBeInTheDocument();
      expect(screen.getByText("Grupo")).toBeInTheDocument();
      expect(screen.getByText("Estado")).toBeInTheDocument();
    });

    it("muestra el badge de estado en cada fila", async () => {
      render(<EjerciciosPage />);
      await screen.findByText("Press Militar");
      expect(screen.getAllByText("Activo")).toHaveLength(2);
    });

    it("no renderiza botones por fila (Modificar/Eliminar están en la ActionBar)", async () => {
      render(<EjerciciosPage />);
      await screen.findByText("Press Militar");
      // Solo existen los de la ActionBar, no dentro de la tabla.
      expect(screen.getAllByRole("button", { name: "Modificar" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Eliminar" })).toHaveLength(1);
      expect(screen.getByRole("table", { name: "Ejercicios" })).not.toContainElement(
        screen.getByRole("button", { name: "Modificar" }),
      );
    });
  });

  describe("Selección de fila", () => {
    it("click en una fila la selecciona (aria-selected)", async () => {
      const user = userEvent.setup();
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      const row = screen.getAllByRole("row").find(
        (r) => r.getAttribute("aria-selected") === "true",
      );
      expect(row).toBeDefined();
      expect(row).toHaveClass("bg-[#FC4C02]");
    });
  });

  describe("Modificar", () => {
    it("está deshabilitado sin selección", async () => {
      render(<EjerciciosPage />);
      await screen.findByText("Press Militar");
      expect(screen.getByRole("button", { name: "Modificar" })).toBeDisabled();
    });

    it("carga la fila seleccionada en el form", async () => {
      const user = userEvent.setup();
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));
      expect(screen.getByTestId("form-nombre")).toHaveTextContent("Press Militar");
    });

    it("al guardar llama updateEjercicio con el id seleccionado", async () => {
      const user = userEvent.setup();
      (ejercicioApi.updateEjercicio as jest.Mock).mockResolvedValue(mockEjercicio);
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));
      await user.click(screen.getByRole("button", { name: /Save/i }));
      await waitFor(() =>
        expect(ejercicioApi.updateEjercicio).toHaveBeenCalledWith(
          "1",
          expect.objectContaining({ nombre: "Test" }),
        ),
      );
      expect(mockNotify).toHaveBeenCalledWith("success", "Ejercicio actualizado");
    });
  });

  describe("Eliminar", () => {
    it("está deshabilitado sin selección", async () => {
      render(<EjerciciosPage />);
      await screen.findByText("Press Militar");
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
    });

    it("confirma y elimina la fila seleccionada", async () => {
      const user = userEvent.setup();
      (ejercicioApi.deleteEjercicio as jest.Mock).mockResolvedValue(undefined);
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      await waitFor(() => expect(ejercicioApi.deleteEjercicio).toHaveBeenCalledWith("1"));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Ejercicio eliminado"));
      confirmSpy.mockRestore();
    });

    it("no elimina si se cancela la confirmación", async () => {
      const user = userEvent.setup();
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      expect(ejercicioApi.deleteEjercicio).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it("muestra el aviso de integridad referencial si el borrado está bloqueado", async () => {
      const user = userEvent.setup();
      (ejercicioApi.deleteEjercicio as jest.Mock).mockRejectedValue(
        new ApiError(409, "mensaje del servidor", "DELETE_BLOCKED_ASSIGNED"),
      );
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      expect(
        await screen.findByText("No se puede eliminar: este ejercicio está en uso por una o más rutinas"),
      ).toBeInTheDocument();
      expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
      confirmSpy.mockRestore();
    });
  });

  describe("Buscar", () => {
    it("abre el input en la ActionBar y filtra la tabla", async () => {
      const user = userEvent.setup();
      render(<EjerciciosPage />);
      await screen.findByText("Press Militar");

      await user.click(screen.getByRole("button", { name: "Buscar" }));
      const input = screen.getByLabelText("Buscar ejercicios");
      expect(input).toBeInTheDocument();

      await user.type(input, "sent");
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
      expect(screen.queryByText("Press Militar")).not.toBeInTheDocument();
    });
  });

  describe("Crear", () => {
    it("al guardar sin selección llama createEjercicio", async () => {
      const user = userEvent.setup();
      (ejercicioApi.createEjercicio as jest.Mock).mockResolvedValue(mockEjercicio2);
      render(<EjerciciosPage />);
      await screen.findByText("Press Militar");
      await user.click(screen.getByRole("button", { name: /Save/i }));
      await waitFor(() => expect(ejercicioApi.createEjercicio).toHaveBeenCalled());
      expect(mockNotify).toHaveBeenCalledWith("success", "Ejercicio creado");
    });
  });

  describe("Error handling", () => {
    it("should show error message if fetch fails", async () => {
      (ejercicioApi.fetchEjercicios as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));
      render(<EjerciciosPage />);
      await waitFor(() =>
        expect(screen.getByText(/No hay conexión con el servidor/i)).toBeInTheDocument(),
      );
    });

    it("un 5xx no muestra el detalle técnico", async () => {
      (ejercicioApi.fetchEjercicios as jest.Mock).mockRejectedValue(
        new ApiError(500, "prisma exploded", "SERVER_ERROR"),
      );
      render(<EjerciciosPage />);
      expect(await screen.findByText(/No se pudo procesar la solicitud/i)).toBeInTheDocument();
      expect(screen.queryByText(/prisma exploded/i)).not.toBeInTheDocument();
    });
  });
});
