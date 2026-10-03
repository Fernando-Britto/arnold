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

const mockAuth = useAuth as jest.Mock;
const mockFetch = api.fetchHomeInternoData as jest.MockedFunction<typeof api.fetchHomeInternoData>;

const staff = {
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol: "ADMINISTRADOR" },
};

const data = buildHomeInternoData();

const loaded = () => waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());

describe("HomeInternoPage Part 1 (Row_Acciones, Row_Hoy, Row_Operacion)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(data);
  });

  it("redirects to /login when not authenticated, without fetching", () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isMember: false, isStaff: false, user: null });
    render(<HomeInternoPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("redirects a Socio to /home-socio before any zone renders (AC-008)", () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false, user: { nombre: "Socio", rol: "SOCIO" } });
    render(<HomeInternoPage />);
    expect(mockPush).toHaveBeenCalledWith("/home-socio");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByText("Nuevo Socio")).not.toBeInTheDocument();
  });

  it("renders the 4 quick actions with literal labels (AC-001) and the role/date header", async () => {
    mockAuth.mockReturnValue(staff);
    render(<HomeInternoPage />);
    await loaded();
    for (const label of ["Nuevo Socio", "Registrar Pago", "Asignar Rutina", "Control Acceso"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Admin · Miércoles, 30 de Septiembre de 2026")).toBeInTheDocument();
  });

  it("binds Row_Hoy: alertas, aforo and caja come from the aggregated data", async () => {
    mockAuth.mockReturnValue(staff);
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByText("Vencimiento · Marta G.")).toBeInTheDocument();
    expect(screen.getByText("87 / 100 miembros")).toBeInTheDocument();
    expect(screen.getByTestId("caja-total")).toHaveTextContent("$350.00");
    expect(screen.getByText("$150.00")).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument();
  });

  it("binds Row_Operacion: the 3 status cards use the spec's data scenarios", async () => {
    mockAuth.mockReturnValue(staff);
    render(<HomeInternoPage />);
    await loaded();
    const equipos = screen.getByRole("button", { name: /estado de equipos/i });
    expect(within(equipos).getByText("90%")).toBeInTheDocument();
    expect(within(equipos).getByText("2 en mantenimiento")).toBeInTheDocument();
    const personal = screen.getByRole("button", { name: /personal en turno/i });
    expect(within(personal).getByText("1 entrenador, 1 staff")).toBeInTheDocument();
    const inactivos = screen.getByRole("button", { name: /socios inactivos/i });
    expect(within(inactivos).getByText("42")).toBeInTheDocument();
    expect(within(inactivos).getByText("Sin visita > 15 días")).toBeInTheDocument();
  });

  it("Nuevo Socio navigates to the Clientes CRUD screen", async () => {
    mockAuth.mockReturnValue(staff);
    render(<HomeInternoPage />);
    await loaded();
    await userEvent.setup().click(screen.getByRole("button", { name: "Nuevo Socio" }));
    expect(mockPush).toHaveBeenCalledWith("/clientes");
  });

  it("Socios inactivos card and an alert's 'Ver' navigate to the Clientes list", async () => {
    mockAuth.mockReturnValue(staff);
    render(<HomeInternoPage />);
    await loaded();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /socios inactivos/i }));
    await user.click(screen.getByRole("button", { name: /ver/i }));
    expect(mockPush).toHaveBeenNthCalledWith(1, "/clientes");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/clientes");
  });

  it("shows 'Aforo no configurado' instead of crashing when ConfiguracionDelSistema values are null", async () => {
    mockAuth.mockReturnValue(staff);
    mockFetch.mockResolvedValue({ ...data, config: { capacidadMaxima: null, periodoGracia: null, diasInactividad: null } });
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByText("Aforo no configurado")).toBeInTheDocument();
  });

  it("shows an error message when the summary fails to load", async () => {
    mockAuth.mockReturnValue(staff);
    mockFetch.mockRejectedValue(new Error("boom"));
    render(<HomeInternoPage />);
    expect(await screen.findByText("No se pudo cargar el resumen operativo")).toBeInTheDocument();
  });
});
