import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaquinasPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/maquinas",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");
jest.mock("@/contexts/notifications");
const mockNotify = jest.fn();

jest.mock("@/api/maquinas", () => ({
  fetchMaquinasList: jest.fn(),
  deleteMaquina: jest.fn(),
}));

import * as maquinasApi from "@/api/maquinas";

const mockMaquinasApi = maquinasApi as jest.Mocked<typeof maquinasApi>;

jest.mock("@/components/maquina-crud/maquina-form-panel", () => ({
  MaquinaFormPanel: ({
    initialData,
    onSuccess,
  }: {
    initialData: { id?: string; nombre?: string } | null;
    onSuccess?: (maquina: { id: string; nombre: string }) => void;
  }) => (
    <div data-testid="maquina-form-panel">
      <span data-testid="form-nombre">{initialData?.nombre ?? ""}</span>
      <span data-testid="form-id">{initialData?.id ?? "nueva"}</span>
      <button type="button" data-testid="form-success" onClick={() => onSuccess?.({ id: "mq-new", nombre: "Nueva máquina" })}>
        Simular guardado
      </button>
    </div>
  ),
}));

const maquina1 = {
  id: "cm2k1vq9n0000abc123def456",
  nombre: "Polea alta",
  ubicacion: "Sala principal",
  tipoEquipamiento: "MAQUINA_GUIADA" as const,
  estado: "DISPONIBLE" as const,
  fechaAlta: new Date(),
  updatedAt: new Date(),
};

function setupAuth(rol: string | null, authenticated: boolean) {
  (useAuth as jest.Mock).mockReturnValue({
    user: rol ? { id: "user1", rol } : null,
    isAuthenticated: authenticated,
  });
}

describe("MaquinasPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    setupAuth("ADMINISTRADOR", true);
    mockMaquinasApi.fetchMaquinasList.mockResolvedValue([maquina1]);
  });

  it("renders the list and the Nueva máquina button for ADMIN", async () => {
    render(<MaquinasPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Máquinas" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Nueva máquina" })).toBeInTheDocument();
      expect(screen.getByRole("table", { name: "Máquinas" })).toBeInTheDocument();
      expect(screen.getByText("Polea alta")).toBeInTheDocument();
    });
  });

  it("redirects INSTRUCTOR to /home-socio", async () => {
    setupAuth("INSTRUCTOR", true);
    render(<MaquinasPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
  });

  it("redirects unauthenticated users to /login", async () => {
    setupAuth(null, false);
    render(<MaquinasPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
  });

  it("shows Acceso Denegado for unauthorized roles", async () => {
    setupAuth("SOCIO", true);
    render(<MaquinasPage />);
    expect(await screen.findByText("Acceso Denegado")).toBeInTheDocument();
  });

  it("opens the modal with empty data when Nueva máquina is clicked", async () => {
    const user = userEvent.setup();
    render(<MaquinasPage />);
    await screen.findByText("Polea alta");
    await user.click(screen.getByRole("button", { name: "Nueva máquina" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByTestId("form-nombre")).toHaveTextContent("");
    expect(within(dialog).getByTestId("form-id")).toHaveTextContent("nueva");
  });

  it("opens the modal with selected machine when Modificar is clicked", async () => {
    const user = userEvent.setup();
    render(<MaquinasPage />);
    await user.click(await screen.findByText("Polea alta"));
    await user.click(screen.getByRole("button", { name: "Modificar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("form-nombre")).toHaveTextContent("Polea alta");
    expect(within(dialog).getByTestId("form-id")).toHaveTextContent(maquina1.id);
  });

  it("deletes after confirmation and notifies success", async () => {
    const user = userEvent.setup();
    mockMaquinasApi.deleteMaquina.mockResolvedValue(undefined);
    render(<MaquinasPage />);
    await user.click(await screen.findByText("Polea alta"));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mockMaquinasApi.deleteMaquina).toHaveBeenCalledWith(maquina1.id));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Máquina eliminada"));
    expect(screen.queryByText("Polea alta")).not.toBeInTheDocument();
  });

  it("shows the server 409 message when delete is blocked", async () => {
    const user = userEvent.setup();
    mockMaquinasApi.deleteMaquina.mockRejectedValue(
      new ApiError(409, "No se puede eliminar: 2 ejercicios usan esta máquina", "DELETE_BLOCKED_EJERCICIOS")
    );
    render(<MaquinasPage />);
    await user.click(await screen.findByText("Polea alta"));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByText("No se puede eliminar: 2 ejercicios usan esta máquina")).toBeInTheDocument();
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
  });
});
