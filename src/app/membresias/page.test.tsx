import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiasPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";

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
jest.mock("@/contexts/notifications");
const mockNotify = jest.fn();

jest.mock("@/api/membresias", () => ({
  fetchMembresiasList: jest.fn(),
  deleteMembresia: jest.fn(),
}));

import * as membresiasApi from "@/api/membresias";
const mockMembresiasApi = membresiasApi as jest.Mocked<typeof membresiasApi>;

jest.mock("@/components/membresia-crud/membresia-form-panel", () => ({
  MembresiaFormPanel: ({ initialData }: { initialData: { nombre?: string } | null }) => (
    <div data-testid="membresia-form-panel">
      <span data-testid="form-nombre">{initialData?.nombre ?? ""}</span>
    </div>
  ),
}));

const gold = {
  id: "11111111gold",
  nombre: "Gold",
  precio: 15000,
  periodicidad: 30,
  descripcion: "Premium",
  estado: "ACTIVA" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignedSocioCount: 0,
};

describe("Membresias CRUD Screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
    });
    mockMembresiasApi.fetchMembresiasList.mockResolvedValue([gold]);
  });

  describe("Role-based access control", () => {
    it("renders for ADMINISTRADOR", async () => {
      render(<MembresiasPage />);
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Membresías" })).toBeInTheDocument();
        expect(screen.getByTestId("membresia-form-panel")).toBeInTheDocument();
        expect(screen.getByRole("table", { name: "Membresías" })).toBeInTheDocument();
      });
    });

    it("redirects INSTRUCTOR to /home-socio", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "INSTRUCTOR" },
        isAuthenticated: true,
      });
      render(<MembresiasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
    });

    it("redirects unauthenticated users to /login", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isAuthenticated: false });
      render(<MembresiasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    });

    it("shows access denied for unauthorized roles", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
      });
      render(<MembresiasPage />);
      await waitFor(() => expect(screen.getByText("Acceso Denegado")).toBeInTheDocument());
    });
  });

  describe("Table (mockup alignment)", () => {
    it("renderiza las columnas exactas y el badge de estado", async () => {
      render(<MembresiasPage />);
      await screen.findByText("Gold");
      expect(screen.getByText("ID")).toBeInTheDocument();
      expect(screen.getByText("Precio")).toBeInTheDocument();
      expect(screen.getByText("Periodicidad")).toBeInTheDocument();
      expect(screen.getByText("Estado")).toBeInTheDocument();
      expect(screen.getByText("Activa")).toBeInTheDocument();
    });

    it("no renderiza botones de acción por fila", async () => {
      render(<MembresiasPage />);
      await screen.findByText("Gold");
      const table = screen.getByRole("table", { name: "Membresías" });
      expect(
        within(table).queryByRole("button", { name: /Editar|Eliminar|Modificar/i }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Modificar" })).toHaveLength(1);
    });
  });

  describe("Selección + Modificar + Eliminar", () => {
    it("Modificar/Eliminar deshabilitados sin selección", async () => {
      render(<MembresiasPage />);
      await screen.findByText("Gold");
      expect(screen.getByRole("button", { name: "Modificar" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
    });

    it("click en fila + Modificar carga la membresía en el form", async () => {
      const user = userEvent.setup();
      render(<MembresiasPage />);
      await user.click(await screen.findByText("Gold"));
      await user.click(screen.getByRole("button", { name: "Modificar" }));
      expect(screen.getByTestId("form-nombre")).toHaveTextContent("Gold");
    });

    it("click en fila + Eliminar confirma y borra", async () => {
      const user = userEvent.setup();
      mockMembresiasApi.deleteMembresia.mockResolvedValue(undefined);
      render(<MembresiasPage />);
      await user.click(await screen.findByText("Gold"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
      await waitFor(() =>
        expect(mockMembresiasApi.deleteMembresia).toHaveBeenCalledWith("11111111gold"),
      );
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Membresía eliminada"));
    });

    it("muestra el aviso cuando el borrado está bloqueado por socios asignados", async () => {
      const user = userEvent.setup();
      mockMembresiasApi.deleteMembresia.mockRejectedValue(
        new ApiError(409, "2 socios asignados", "DELETE_BLOCKED_ASSIGNED"),
      );
      render(<MembresiasPage />);
      await user.click(await screen.findByText("Gold"));
      await user.click(screen.getByRole("button", { name: "Eliminar" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
      expect(await screen.findByText(/No se puede eliminar: 2 socios asignados/i)).toBeInTheDocument();
      expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
    });
  });

  describe("Buscar", () => {
    it("filtra la tabla desde la ActionBar", async () => {
      const user = userEvent.setup();
      render(<MembresiasPage />);
      await screen.findByText("Gold");
      await user.click(screen.getByRole("button", { name: "Buscar" }));
      await user.type(screen.getByLabelText("Buscar membresías"), "zzz");
      expect(screen.getByText(/No se encontraron membresías/i)).toBeInTheDocument();
    });
  });
});
