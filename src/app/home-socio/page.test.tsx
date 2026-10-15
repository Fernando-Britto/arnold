import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeSocioPage } from "./page";
import { useAuth } from "@/contexts/auth";
import * as homeSocioApi from "@/api/home-socio";
import type { HomeSocioViewModel } from "@/api/home-socio";
import { fetchSesionEnCurso, iniciarSesionDeEntrenamiento } from "@/api/sesiones";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/home-socio",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");
jest.mock("@/api/home-socio", () => ({ fetchHomeSocioData: jest.fn() }));
jest.mock("@/api/sesiones");

const mockAuth = useAuth as jest.Mock;
const mockFetch = homeSocioApi.fetchHomeSocioData as jest.MockedFunction<
  typeof homeSocioApi.fetchHomeSocioData
>;
const mockEnCurso = fetchSesionEnCurso as jest.MockedFunction<typeof fetchSesionEnCurso>;
const mockIniciar = iniciarSesionDeEntrenamiento as jest.MockedFunction<
  typeof iniciarSesionDeEntrenamiento
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
    rutinaAsignadaId: "asig-1",
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
  oferta: null,
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

  it("renders the three rows (Fila1/2/3) with the six cards of the mockup", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByTestId("fila-1")).toBeInTheDocument();
    expect(screen.getByTestId("fila-2")).toBeInTheDocument();
    expect(screen.getByTestId("fila-3")).toBeInTheDocument();

    for (const id of [
      "card-progreso",
      "card-aforo",
      "card-rutina",
      "card-detalle",
      "card-racha",
      "card-membresia",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it("muestra el aviso de oferta de reactivación arriba de las filas cuando el socio es elegible (D-54)", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockResolvedValue({ ...baseViewModel, oferta: { descuentoPct: 10 } });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    const aviso = screen.getByTestId("aviso-oferta-reactivacion");
    expect(aviso).toBeInTheDocument();
    // El aviso va antes de la primera fila.
    expect(aviso.compareDocumentPosition(screen.getByTestId("fila-1")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("no muestra el aviso de oferta cuando el socio no es elegible", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();
    expect(screen.queryByTestId("aviso-oferta-reactivacion")).not.toBeInTheDocument();
  });

  it("con datos vacíos muestra el estado vacío propio de cada tarjeta, no el placeholder 'Trabajando en esto'", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockResolvedValue({
      ...baseViewModel,
      progreso: null,
      rutinaActiva: null,
      membresia: null,
    });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    // ProgresoSection empty state (not the shared placeholder).
    expect(screen.getByTestId("card-progreso")).toHaveTextContent(
      /todavía no registraste entrenamientos/i
    );
    // TarjetaRutina + Tarjeta_Detalle empty states.
    expect(screen.getByTestId("card-rutina")).toHaveTextContent(/sin rutina asignada/i);
    expect(screen.getByTestId("card-detalle")).toHaveTextContent(/sin rutina asignada/i);
    // MembresiaCard empty state.
    expect(screen.getByTestId("card-membresia")).toHaveTextContent(/sin membresía asignada/i);

    expect(screen.queryByText(/trabajando en esto/i)).not.toBeInTheDocument();
  });

  it("enlaza 'Ver todos los ejercicios' con /home-socio/mis-ejercicios", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /ver todos los ejercicios/i }));

    expect(mockPush).toHaveBeenCalledWith("/home-socio/mis-ejercicios");
  });

  it("enlaza 'Ver mi historial completo' con /home-socio/mis-asistencias", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /ver mi historial completo/i }));

    expect(mockPush).toHaveBeenCalledWith("/home-socio/mis-asistencias");
  });

  it("enlaza 'Ver membresía' y 'Renovar ahora' con /home-socio/mi-membresia", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockResolvedValue({
      ...baseViewModel,
      membresia: { ...baseViewModel.membresia!, fechaVencimiento: "2020-01-01" },
    });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /ver membresía/i }));
    await user.click(screen.getByRole("button", { name: /renovar ahora/i }));

    expect(mockPush).toHaveBeenCalledWith("/home-socio/mi-membresia");
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it("Buscar, Notificaciones y Perfil no son interactivos: no tienen destino todavía", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    const buscar = screen.getByRole("button", { name: /buscar/i });
    const notificaciones = screen.getByRole("button", { name: /notificaciones/i });
    const perfil = screen.getByRole("button", { name: /perfil/i });

    expect(buscar).toBeDisabled();
    expect(notificaciones).toBeDisabled();
    expect(perfil).toBeDisabled();
    expect(buscar.getAttribute("title")).toMatch(/no est|todav/i);
    expect(perfil.getAttribute("title")).toMatch(/no est|todav/i);
  });

  it("shows an error message and does not crash when the fetch fails", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockRejectedValue(new Error("network down"));
    render(<HomeSocioPage />);
    await waitFor(() =>
      expect(screen.getByText(/no pudimos cargar tu inicio/i)).toBeInTheDocument()
    );
  });

  it('clicking "Seguir rutina" opens the run screen (T-038)', async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockEnCurso.mockResolvedValueOnce({
      sesion: null,
      ejercicios: [],
      ultimaSerie: null,
      cargaActual: null,
    });
    mockIniciar.mockResolvedValueOnce({
      sesion: {
        id: "s1",
        rutinaAsignadaId: "asig-1",
        estadoDeFinalizacion: "EN_CURSO",
        horaInicio: "2026-10-12T13:00:00.000Z",
        ejercicioActualId: "e1",
        serieActual: 1,
      },
      ejercicios: [
        { id: "e1", nombre: "Press de Banca", series: 4, repeticiones: 8, descanso: 120, orden: 0 },
      ],
    });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /seguir rutina/i }));

    expect(await screen.findByTestId("ejecucion-rutina")).toBeInTheDocument();
    expect(mockIniciar).toHaveBeenCalledWith("asig-1");
    expect(screen.getByRole("button", { name: /serie hecha/i })).toBeInTheDocument();
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

  // SE-4: al recargar en medio de una sesión, el inicio refleja el estado "retomar" y el
  // ejercicio actual sale del índice devuelto por el servidor.
  it("con una sesión en curso muestra 'Retomar sesión' y el ejercicio actual del índice", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockResolvedValue({
      ...baseViewModel,
      sesionEnProgreso: true,
      rutinaActiva: { ...baseViewModel.rutinaActiva!, indiceActual: 1 },
    });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    // CTA de retomar en vez de "Seguir rutina".
    expect(screen.getByRole("button", { name: /retomar sesión/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /seguir rutina/i })).not.toBeInTheDocument();
    // Tarjeta_Detalle muestra el ejercicio en indiceActual (1 → Press Militar), no el 0.
    expect(screen.getByText("Hombros")).toBeInTheDocument();
  });

  // SE-4 (sin sesión): el estado normal es "empezar" y el índice vuelve a 0.
  it("sin sesión en curso mantiene 'Seguir rutina' y el primer ejercicio", async () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false });
    mockFetch.mockResolvedValue({ ...baseViewModel, sesionEnProgreso: false });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByRole("button", { name: /seguir rutina/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retomar sesión/i })).not.toBeInTheDocument();
    expect(screen.getByText("Pecho")).toBeInTheDocument();
  });
});
