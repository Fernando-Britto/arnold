import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjerciciosPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";
import * as ejercicioApi from "@/api/ejercicios";
import type { EjercicioConUso } from "@/domains/ejercicio/ejercicio";
import { sinCatalogo } from "../../../tests/factories/ejercicio";

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
    initialData: EjercicioConUso | null;
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

const mockEjercicio: EjercicioConUso = {
  id: "1",
  nombre: "Press Militar",
  grupoMuscular: "Hombros",
  descripcion: "Empuje vertical",
  enRutinas: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...sinCatalogo(),
};

const mockEjercicio2: EjercicioConUso = {
  id: "2",
  nombre: "Sentadilla",
  grupoMuscular: "Piernas",
  descripcion: "Flexión de rodillas",
  enRutinas: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...sinCatalogo(),
};

// Ejercicio en uso: la UI debe anticipar el 409 y bloquear el borrado.
const mockEjercicioEnUso: EjercicioConUso = {
  id: "4",
  nombre: "Dominadas",
  grupoMuscular: "Espalda",
  descripcion: "Tirón vertical",
  enRutinas: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...sinCatalogo(),
};

// El alta devuelve un ejercicio NUEVO con un id propio. Reusar mockEjercicio2 (id "2"),
// que ya está en la lista, duplicaba la key de React en la tabla.
const mockEjercicioCreado: EjercicioConUso = {
  id: "3",
  nombre: "Remo con barra",
  grupoMuscular: "Espalda",
  descripcion: "Tirón horizontal",
  enRutinas: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...sinCatalogo(),
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

    it("should deny access for SOCIO role", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
      });
      render(<EjerciciosPage />);
      expect(screen.queryByTestId("ejercicio-form")).not.toBeInTheDocument();
      // Flush el load asíncrono dentro de act: sin esto, setEjercicios/setLoading corren
      // después de terminar el test y React avisa "not wrapped in act(...)".
      await waitFor(() => expect(ejercicioApi.fetchEjercicios).toHaveBeenCalled());
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
      // 2 "—" de Estado + 2 "—" de Rutinas (ninguno está en uso).
      expect(screen.getAllByText("—")).toHaveLength(4);
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
    it("click en una fila la despliega (aria-selected + light-brand)", async () => {
      const user = userEvent.setup();
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      const row = screen.getAllByRole("row").find(
        (r) => r.getAttribute("aria-selected") === "true",
      );
      expect(row).toBeDefined();
      expect(row).toHaveClass("bg-brand-soft");
    });

    it("el segundo click en la misma fila la vuelve a cerrar", async () => {
      const user = userEvent.setup();
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));

      const abierta = screen
        .getAllByRole("row")
        .find((r) => r.getAttribute("aria-selected") === "true");
      expect(abierta).toBeDefined();
      // La fila de detalle (Descripción) sólo vive mientras la fila está abierta.
      expect(screen.getByText("Empuje vertical")).toBeInTheDocument();

      await user.click(screen.getByText("Press Militar"));

      expect(
        screen.getAllByRole("row").some((r) => r.getAttribute("aria-selected") === "true"),
      ).toBe(false);
      expect(screen.queryByText("Empuje vertical")).not.toBeInTheDocument();
      // Sin selección no se puede modificar ni eliminar.
      expect(screen.getByRole("button", { name: "Modificar" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
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

    it("muestra el uso en la lista y bloquea el borrado si está en una rutina", async () => {
      const user = userEvent.setup();
      (ejercicioApi.fetchEjercicios as jest.Mock).mockResolvedValue([mockEjercicioEnUso]);
      render(<EjerciciosPage />);
      await screen.findByText("Dominadas");

      expect(screen.getByText("En 3 rutinas")).toBeInTheDocument();

      await user.click(screen.getByText("Dominadas"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/no se puede eliminar/i)).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Eliminar" })).toBeDisabled();
      expect(ejercicioApi.deleteEjercicio).not.toHaveBeenCalled();
    });

    it("confirma y elimina la fila seleccionada", async () => {
      const user = userEvent.setup();
      (ejercicioApi.deleteEjercicio as jest.Mock).mockResolvedValue(undefined);
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));

      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));

      await waitFor(() => expect(ejercicioApi.deleteEjercicio).toHaveBeenCalledWith("1"));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Ejercicio eliminado"));
    });

    it("no elimina si se cancela la confirmación", async () => {
      const user = userEvent.setup();
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));

      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

      expect(ejercicioApi.deleteEjercicio).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("muestra el aviso de integridad referencial si el borrado está bloqueado", async () => {
      const user = userEvent.setup();
      (ejercicioApi.deleteEjercicio as jest.Mock).mockRejectedValue(
        new ApiError(409, "mensaje del servidor", "DELETE_BLOCKED_ASSIGNED"),
      );
      render(<EjerciciosPage />);
      await user.click(await screen.findByText("Press Militar"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));

      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));

      // H11: el aviso usa el mensaje específico que manda el servidor (rutinas o historial),
      // no un texto fijo de rutinas.
      expect(await screen.findByText("mensaje del servidor")).toBeInTheDocument();
      expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
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
      (ejercicioApi.createEjercicio as jest.Mock).mockResolvedValue(mockEjercicioCreado);
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
