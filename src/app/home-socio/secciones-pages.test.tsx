import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/auth";
import * as seccionesApi from "@/api/home-socio-secciones";
import type { HomeSocioSeccionesViewModel } from "@/api/home-socio-secciones";
import { MiRutinaPage } from "./mi-rutina/page";
import { MisEjerciciosPage } from "./mis-ejercicios/page";
import { ProgresoPage } from "./progreso/page";
import { MiMembresiaPage } from "./mi-membresia/page";
import { MisAsistenciasPage } from "./mis-asistencias/page";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/home-socio",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");
jest.mock("@/api/home-socio-secciones", () => ({ fetchHomeSocioSeccionesData: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockFetch = seccionesApi.fetchHomeSocioSeccionesData as jest.MockedFunction<
  typeof seccionesApi.fetchHomeSocioSeccionesData
>;

const VM: HomeSocioSeccionesViewModel = {
  rutina: {
    nombre: "Fuerza A",
    rutinaAsignadaId: "ra1",
    ejercicios: [
      { id: "e1", nombre: "Press de Banca", grupoMuscular: "Pecho", descripcion: "Baja la barra.", series: 4, repeticiones: 8, descanso: 120, mejorMarca: 80 },
    ],
  },
  sesiones: [
    { id: "s1", horaInicio: "2026-10-06T13:00:00.000Z", horaFin: "2026-10-06T14:05:00.000Z", estado: "COMPLETADA", duracionMin: 65 },
  ],
  sesionEnCurso: null,
  ejercicios: [
    { id: "e1", nombre: "Press de Banca", grupoMuscular: "Pecho", descripcion: "Baja la barra.", series: 4, repeticiones: 8, descanso: 120, mejorMarca: 80 },
  ],
  progreso: [
    { ejercicioId: "e1", ejercicioNombre: "Press de Banca", serie: [{ fecha: "2026-10-05", carga: 80 }], mejorMarca: 80, delta: 0 },
  ],
  membresia: {
    planNombre: "Plan Musculación",
    estado: "AL_DIA",
    ultimoPeriodoCubierto: "2026-10",
    fechaVencimiento: "2026-10-31T23:59:59.999-03:00",
    historial: [{ id: "p1", fechaPago: "2026-10-02T13:00:00.000Z", monto: 100, metodoPago: "EFECTIVO", periodo: "2026-10" }],
  },
  asistencias: {
    rachaSemanas: 2,
    total: 3,
    dias: Array.from({ length: 35 }, (_, i) => ({ fecha: `2026-09-${String(3 + i).padStart(2, "0")}`, asistio: i % 7 === 0 })),
  },
};

const VACIO: HomeSocioSeccionesViewModel = {
  rutina: null,
  sesiones: [],
  sesionEnCurso: null,
  ejercicios: [],
  progreso: [],
  membresia: null,
  asistencias: { rachaSemanas: 0, total: 0, dias: Array.from({ length: 35 }, (_, i) => ({ fecha: `2026-09-${String(3 + i).padStart(2, "0")}`, asistio: false })) },
};

const waitForLoadingComplete = () =>
  waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());

describe("secciones del socio: páginas (T-039)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockResolvedValue(VM);
  });

  it("cada página redirige a /login sin sesión", () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isMember: false });
    render(<MiRutinaPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("cada página redirige a /home-interno para personal", () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: false, isStaff: true });
    render(<ProgresoPage />);
    expect(mockPush).toHaveBeenCalledWith("/home-interno");
  });

  it("Mi rutina: datos y estado vacío", async () => {
    const { unmount } = render(<MiRutinaPage />);
    await waitForLoadingComplete();
    expect(screen.getByText("Fuerza A")).toBeInTheDocument();
    expect(screen.getByTestId("sesion-historial")).toBeInTheDocument();
    unmount();

    mockFetch.mockResolvedValue(VACIO);
    render(<MiRutinaPage />);
    await waitForLoadingComplete();
    expect(screen.getByText(/no tenés una rutina asignada/i)).toBeInTheDocument();
  });

  it("Mis ejercicios: datos y estado vacío", async () => {
    const { unmount } = render(<MisEjerciciosPage />);
    await waitForLoadingComplete();
    expect(screen.getByTestId("ejercicio-card")).toBeInTheDocument();
    unmount();

    mockFetch.mockResolvedValue(VACIO);
    render(<MisEjerciciosPage />);
    await waitForLoadingComplete();
    expect(screen.getByText(/no tenés ejercicios asignados/i)).toBeInTheDocument();
  });

  it("Progreso: datos y estado vacío", async () => {
    const { unmount } = render(<ProgresoPage />);
    await waitForLoadingComplete();
    expect(screen.getByTestId("progreso-ejercicio")).toBeInTheDocument();
    unmount();

    mockFetch.mockResolvedValue(VACIO);
    render(<ProgresoPage />);
    await waitForLoadingComplete();
    expect(screen.getByText(/todavía no registraste entrenamientos/i)).toBeInTheDocument();
  });

  it("Mi membresía: datos y estado vacío", async () => {
    const { unmount } = render(<MiMembresiaPage />);
    await waitForLoadingComplete();
    expect(screen.getByTestId("estado-pago")).toHaveTextContent("Al día");
    unmount();

    mockFetch.mockResolvedValue(VACIO);
    render(<MiMembresiaPage />);
    await waitForLoadingComplete();
    expect(screen.getByText(/no tenés pagos ni membresía/i)).toBeInTheDocument();
  });

  it("Mis asistencias: datos y estado vacío", async () => {
    const { unmount } = render(<MisAsistenciasPage />);
    await waitForLoadingComplete();
    expect(screen.getByTestId("asistencias-racha")).toHaveTextContent("2");
    unmount();

    mockFetch.mockResolvedValue(VACIO);
    render(<MisAsistenciasPage />);
    await waitForLoadingComplete();
    expect(screen.getByText(/todavía no registraste asistencias/i)).toBeInTheDocument();
  });

  it("muestra el error cuando falla la carga", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    render(<MiMembresiaPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/no pudimos cargar tus datos/i));
  });
});
