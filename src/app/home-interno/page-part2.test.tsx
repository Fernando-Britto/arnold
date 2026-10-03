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

const asRol = (rol: string) => ({
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol },
});

const loaded = () => waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());

describe("HomeInternoPage Part 2 (Row_Gestion, Col_Actividad, full integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue(asRol("ADMINISTRADOR"));
    mockFetch.mockResolvedValue(buildHomeInternoData());
  });

  it("Row_Gestion renders the 4 counters with the live counts", async () => {
    render(<HomeInternoPage />);
    await loaded();
    const expected: [RegExp, string][] = [
      [/^Rutinas/, "124"],
      [/^Ejercicios/, "342"],
      [/^Clientes/, "892"],
      [/^Membresías/, "15"],
    ];
    for (const [name, metric] of expected) {
      expect(within(screen.getByRole("button", { name })).getByText(metric)).toBeInTheDocument();
    }
  });

  it.each([
    [/^Rutinas/, "/rutinas"],
    [/^Ejercicios/, "/ejercicios"],
    [/^Clientes/, "/clientes"],
    [/^Membresías/, "/membresias"],
  ])("clicking the %s card navigates to %s", async (name, ruta) => {
    render(<HomeInternoPage />);
    await loaded();
    await userEvent.setup().click(screen.getByRole("button", { name }));
    expect(mockPush).toHaveBeenCalledWith(ruta);
  });

  it("shows a zero count as '0', not blank", async () => {
    mockFetch.mockResolvedValue(
      buildHomeInternoData({ contadores: { rutinas: 0, ejercicios: 342, clientes: 892, membresias: 15 } })
    );
    render(<HomeInternoPage />);
    await loaded();
    expect(within(screen.getByRole("button", { name: /^Rutinas/ })).getByText("0")).toBeInTheDocument();
  });

  it("disables the cards whose section the role cannot open (INSTRUCTOR: no Clientes/Membresías)", async () => {
    mockAuth.mockReturnValue(asRol("INSTRUCTOR"));
    render(<HomeInternoPage />);
    await loaded();
    expect(screen.getByRole("button", { name: /^Clientes/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Membresías/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Rutinas/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Ejercicios/ })).toBeEnabled();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Clientes/ }));
    expect(mockPush).not.toHaveBeenCalled();
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
    expect(screen.getByText("Alertas críticas")).toBeInTheDocument(); // Row_Hoy
    expect(screen.getByRole("button", { name: /estado de equipos/i })).toBeInTheDocument(); // Row_Operacion
    expect(screen.getByRole("button", { name: /^Rutinas/ })).toBeInTheDocument(); // Row_Gestion
    expect(screen.getByText("Últimos movimientos")).toBeInTheDocument(); // Col_Actividad
    for (const label of ["HOY", "OPERACIÓN", "GESTIÓN", "ACTIVIDAD RECIENTE"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
