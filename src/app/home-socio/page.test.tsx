import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeSocioPage } from "./page";
import { useAuth } from "@/contexts/auth";
import * as homeSocioApi from "@/api/home-socio";
import type { HomeSocioViewModel } from "@/api/home-socio";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/home-socio",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");
jest.mock("@/api/home-socio", () => ({ fetchHomeSocioData: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockFetch = homeSocioApi.fetchHomeSocioData as jest.MockedFunction<
  typeof homeSocioApi.fetchHomeSocioData
>;

const baseViewModel: HomeSocioViewModel = {
  progreso: {
    ejercicioNombre: "Press de Banca",
    marcaActual: 80,
    deltaEsteMes: 7.5,
    progresionCarga: [
      { fecha: "2026-05-12", carga: 60 },
      { fecha: "2026-09-26", carga: 80 },
    ],
    proximaSesionSugerida: 82.5,
  },
  aforo: {
    ocupacionActual: 47,
    capacidadMaxima: 80,
    horas: [{ hora: 22, ocupacion: 30 }],
    horaActual: 22,
  },
  rutinaActiva: {
    nombre: "Hipertrofia - Empuje A",
    ejercicios: [
      {
        id: "e1",
        nombre: "Press de Banca",
        grupoMuscular: "Pecho",
        descripcion: "Baja la barra al pecho.",
        series: 4,
        repeticiones: 8,
        descanso: 120,
      },
      {
        id: "e2",
        nombre: "Press Militar",
        grupoMuscular: "Hombros",
        descripcion: "Empuja la barra por encima de la cabeza.",
        series: 3,
        repeticiones: 10,
        descanso: 120,
      },
    ],
    indiceActual: 0,
  },
  sesionEnProgreso: false,
  racha: {
    semanasRacha: 3,
    dias: [
      { numero: 21, asistio: true, esHoy: false },
      { numero: 22, asistio: true, esHoy: false },
      { numero: 23, asistio: false, esHoy: false },
      { numero: 24, asistio: true, esHoy: true },
      { numero: 25, asistio: false, esHoy: false },
      { numero: 26, asistio: false, esHoy: false },
      { numero: 27, asistio: false, esHoy: false },
    ],
  },
  membresia: {
    planNombre: "Plan Musculación",
    fechaVencimiento: "2026-10-20",
    diasTotalMembresia: 30,
    dias28: new Array(28).fill(false),
    totalAsistencias28Dias: 12,
  },
};

const waitForLoadingComplete = () =>
  waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());

describe("HomeSocioPage (spec: matches Home_Socio_1x layout, TopNav + Fila1/2/3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(baseViewModel);
  });

  it("redirects to /login when not authenticated", () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isMember: false });
    render(<HomeSocioPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("redirects staff to /home-interno", () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: false, isStaff: true });
    render(<HomeSocioPage />);
    expect(mockPush).toHaveBeenCalledWith("/home-interno");
  });

  it("renders the TopNav with Inicio active, and all three rows for a Socio", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByTestId("nav-link-inicio")).toHaveAttribute("data-active", "true");
    // Fila1
    expect(screen.getByTestId("marca-actual")).toHaveTextContent("80 kg");
    expect(screen.getByText("47 / 80")).toBeInTheDocument();
    // Fila2
    expect(screen.getByText("Hipertrofia - Empuje A")).toBeInTheDocument();
    expect(screen.getByText("Pecho")).toBeInTheDocument(); // Tarjeta_Detalle for indiceActual=0
    // Fila3
    expect(screen.getByTestId("racha-count")).toHaveTextContent("3");
    expect(screen.getByText("Plan Musculación")).toBeInTheDocument();
  });

  it("shows an error message and does not crash when the fetch fails", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockRejectedValue(new Error("network down"));
    render(<HomeSocioPage />);
    await waitFor(() =>
      expect(screen.getByText(/no pudimos cargar tu inicio/i)).toBeInTheDocument()
    );
  });

  it('clicking "Seguir rutina" marks the session in progress', async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /seguir rutina/i }));
    // The exercise state for e1 (before indiceActual) should read "completado"
    expect(screen.getByTestId("ejercicio-e1")).toHaveAttribute("data-estado", "completado");
  });

  it('el botón "Cerrar sesión" del TopNav cierra la sesión (logout del contexto)', async () => {
    const logout = jest.fn();
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false, logout });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
