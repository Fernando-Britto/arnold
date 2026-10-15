/**
 * Pantalla "Dispositivos" (AC-11): lista, alta con token mostrado una sola vez y desactivación.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DispositivosPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import {
  cambiarEstadoDispositivo,
  crearDispositivo,
  fetchDispositivos,
} from "@/api/dispositivos";
import type { DispositivoDTO } from "@/api/dispositivos";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/dispositivos",
}));
jest.mock("@/contexts/auth");
jest.mock("@/contexts/notifications");
jest.mock("@/api/dispositivos", () => ({
  fetchDispositivos: jest.fn(),
  crearDispositivo: jest.fn(),
  cambiarEstadoDispositivo: jest.fn(),
}));

const mockAuth = useAuth as jest.Mock;
const mockNotify = jest.fn();
const mockFetch = fetchDispositivos as jest.MockedFunction<typeof fetchDispositivos>;
const mockCrear = crearDispositivo as jest.MockedFunction<typeof crearDispositivo>;
const mockEstado = cambiarEstadoDispositivo as jest.MockedFunction<typeof cambiarEstadoDispositivo>;

const activo: DispositivoDTO = {
  id: "dev-1",
  nombre: "Puerta principal",
  tipo: "PUERTA",
  estado: "ACTIVO",
  ultimoContacto: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const asRol = (rol: string) => ({
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol },
});

describe("DispositivosPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue(asRol("ADMINISTRADOR"));
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    mockFetch.mockResolvedValue([activo]);
  });

  it("renderiza la lista de dispositivos", async () => {
    render(<DispositivosPage />);
    expect(await screen.findByText("Puerta principal")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("al crear muestra el token una sola vez con el aviso", async () => {
    const user = userEvent.setup();
    mockCrear.mockResolvedValueOnce({ dispositivo: { ...activo, id: "dev-2" }, token: "tok-secreto" });
    render(<DispositivosPage />);
    await screen.findByText("Puerta principal");

    await user.type(screen.getByTestId("dispositivo-nombre"), "Tablet recepción");
    await user.click(screen.getByRole("button", { name: /crear dispositivo/i }));

    expect(await screen.findByTestId("dispositivo-token")).toHaveTextContent("tok-secreto");
    expect(screen.getByText(/no se volverá a mostrar/i)).toBeInTheDocument();
    expect(mockCrear).toHaveBeenCalledWith({ nombre: "Tablet recepción", tipo: "PUERTA" });
    expect(mockNotify).toHaveBeenCalledWith("success", "Dispositivo creado.");
  });

  it("desactivar llama a la API y refleja el nuevo estado", async () => {
    const user = userEvent.setup();
    mockEstado.mockResolvedValueOnce({ ...activo, estado: "INACTIVO" });
    render(<DispositivosPage />);
    await screen.findByText("Puerta principal");

    await user.click(screen.getByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(mockEstado).toHaveBeenCalledWith("dev-1", "INACTIVO"));
    expect(await screen.findByText("Inactivo")).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith("success", "Dispositivo desactivado.");
  });

  it("un rol no autorizado ve Acceso Denegado y no carga", async () => {
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    render(<DispositivosPage />);
    expect(await screen.findByText("Acceso Denegado")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("redirige a /login cuando no hay sesión", () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isMember: false, isStaff: false, user: null });
    render(<DispositivosPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
