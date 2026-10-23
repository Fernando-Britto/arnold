import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeInternoPage } from "./page";
import { useAuth } from "@/contexts/auth";
import * as api from "@/api/home-interno";
import { buildHomeInternoData } from "../../../tests/fixtures/home-interno-data";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/home-interno",
}));
jest.mock("@/contexts/auth");
jest.mock("@/api/home-interno", () => ({ fetchHomeInternoData: jest.fn() }));
jest.mock("@/components/rutina/asignar-rutina-modal", () => ({
  AsignarRutinaModal: ({ onClose }: { onClose: () => void }) => (
    <div>
      <span>Modal asignar rutina</span>
      <button type="button" onClick={onClose}>
        Cerrar modal
      </button>
    </div>
  ),
}));

const mockAuth = useAuth as jest.Mock;
const mockFetch = api.fetchHomeInternoData as jest.MockedFunction<typeof api.fetchHomeInternoData>;

const asRol = (rol: string) => ({
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol },
});

const loaded = () => waitFor(() => expect(screen.getByTestId("caja-total")).toBeInTheDocument());

describe("HomeInternoPage Part 2 (Row_Gestion, Col_Actividad, full integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // HI-3: la página cachea el último panel en sessionStorage; se aísla entre tests.
    sessionStorage.clear();
    mockAuth.mockReturnValue(asRol("ADMINISTRADOR"));
    mockFetch.mockResolvedValue(buildHomeInternoData());
  });

  it("Col_Actividad shows 'Nombre · Acción · Hace X' for payments and signups", async () => {
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByText("Últimos movimientos")).toBeInTheDocument();
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("Pago de membresía Pro")).toBeInTheDocument();
    expect(screen.getByText("Hace 15 min")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mendez")).toBeInTheDocument();
    expect(screen.getByText("Hace 2 horas")).toBeInTheDocument();
  });

  it("Col_Actividad excludes check-ins and events older than 24h", async () => {
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.queryByText("Lucía Paz")).not.toBeInTheDocument();
    expect(screen.queryByText("Viejo Pago")).not.toBeInTheDocument();
  });

  it("Col_Actividad shows the empty state when nothing qualifies", async () => {
    mockFetch.mockResolvedValue(buildHomeInternoData({ eventos: [] }));
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByText("Sin movimientos en las últimas 24 horas.")).toBeInTheDocument();
  });

  it("integrates all five zones in one page", async () => {
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByRole("button", { name: "Nuevo Socio" })).toBeInTheDocument(); // Row_Acciones
    expect(screen.getByTestId("pendientes-de-hoy")).toBeInTheDocument(); // excepciones accionables
    expect(screen.getByRole("button", { name: /estado de equipos/i })).toBeInTheDocument(); // Operación
    expect(screen.getByText("Últimos movimientos")).toBeInTheDocument(); // Actividad
    // Los contadores de gestión se retiraron: son totales que ya están en el rail.
    expect(screen.queryByRole("button", { name: /^Rutinas/ })).not.toBeInTheDocument();
  });

  it("INSTRUCTOR: every entry point to /clientes is disabled (Nuevo Socio, Ver, Socios inactivos)", async () => {
    mockAuth.mockReturnValue(asRol("INSTRUCTOR"));
    render(<HomeInternoPage />);
    await loaded();
    const user = userEvent.setup();
    const puertas = [
      screen.getByRole("button", { name: "Nuevo Socio" }),
      screen.getByRole("button", { name: /socios inactivos/i }),
    ];
    for (const puerta of puertas) {
      expect(puerta).toBeDisabled();
      await user.click(puerta);
    }
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("RECEPCIONISTA puede accionar sus dos entradas a Clientes y cobrar desde el pendiente", async () => {
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByRole("button", { name: "Nuevo Socio" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /socios inactivos/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cobrar" })).toBeEnabled();
  });

  it("Registrar Pago navigates to /pagos for ADMINISTRADOR", async () => {
    render(<HomeInternoPage />);
    await loaded();
    await userEvent.setup().click(screen.getByRole("button", { name: "Registrar Pago" }));
    expect(mockPush).toHaveBeenCalledWith("/pagos");
  });

  it("Registrar Pago navigates to /pagos for RECEPCIONISTA", async () => {
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    render(<HomeInternoPage />);
    await loaded();
    await userEvent.setup().click(screen.getByRole("button", { name: "Registrar Pago" }));
    expect(mockPush).toHaveBeenCalledWith("/pagos");
  });

  it("INSTRUCTOR cannot open Registrar Pago (disabled, no navigation)", async () => {
    mockAuth.mockReturnValue(asRol("INSTRUCTOR"));
    render(<HomeInternoPage />);
    await loaded();
    const boton = screen.getByRole("button", { name: "Registrar Pago" });
    expect(boton).toBeDisabled();
    await userEvent.setup().click(boton);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Asignar Rutina abre el modal para ADMINISTRADOR", async () => {
    render(<HomeInternoPage />);
    await loaded();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Asignar Rutina" }));
    expect(screen.getByText("Modal asignar rutina")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar modal" }));
    expect(screen.queryByText("Modal asignar rutina")).not.toBeInTheDocument();
  });

  it("Asignar Rutina abre el modal para INSTRUCTOR", async () => {
    mockAuth.mockReturnValue(asRol("INSTRUCTOR"));
    render(<HomeInternoPage />);
    await loaded();
    const boton = screen.getByRole("button", { name: "Asignar Rutina" });
    expect(boton).toBeEnabled();
    await userEvent.setup().click(boton);
    expect(screen.getByText("Modal asignar rutina")).toBeInTheDocument();
  });

  it("RECEPCIONISTA no puede abrir Asignar Rutina (disabled, sin modal)", async () => {
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    render(<HomeInternoPage />);
    await loaded();
    const boton = screen.getByRole("button", { name: "Asignar Rutina" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("title", "Sin acceso con tu rol");
    await userEvent.setup().click(boton);
    expect(screen.queryByText("Modal asignar rutina")).not.toBeInTheDocument();
  });

  it("Control Acceso navega a /acceso para ADMINISTRADOR", async () => {
    render(<HomeInternoPage />);
    await loaded();
    await userEvent.setup().click(screen.getByRole("button", { name: "Control Acceso" }));
    expect(mockPush).toHaveBeenCalledWith("/acceso");
  });

  it("Control Acceso navega a /acceso para RECEPCIONISTA", async () => {
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    render(<HomeInternoPage />);
    await loaded();
    await userEvent.setup().click(screen.getByRole("button", { name: "Control Acceso" }));
    expect(mockPush).toHaveBeenCalledWith("/acceso");
  });

  it("INSTRUCTOR no puede abrir Control Acceso (disabled, sin navegación)", async () => {
    mockAuth.mockReturnValue(asRol("INSTRUCTOR"));
    render(<HomeInternoPage />);
    await loaded();
    const boton = screen.getByRole("button", { name: "Control Acceso" });
    expect(boton).toBeDisabled();
    await userEvent.setup().click(boton);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
