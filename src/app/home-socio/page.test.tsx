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
      { fecha: "2026-09-12", carga: 60 },
      { fecha: "2026-09-26", carga: 75 },
      { fecha: "2026-10-10", carga: 80 },
    ],
    sugerencia: {
      tipo: "subir",
      carga: 82.5,
      motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg.",
    },
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
        mediaId: "0001-2gPfomN",
        grupoMuscular: "Pecho",
        descripcion: "Baja la barra al pecho.",
        series: 4,
        repeticiones: 8,
        descanso: 120,
      },
      {
        id: "e2",
        nombre: "Press Militar",
        mediaId: null,
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
    fechaVencimiento: "2026-12-20",
    diasTotalMembresia: 30,
    dias28: new Array(28).fill(false),
    totalAsistencias28Dias: 12,
  },
  oferta: null,
  ultimasSesiones: [
    {
      id: "s-1",
      fecha: "2026-10-16T13:00:00.000Z",
      rutinaNombre: "Torso B",
      series: 18,
      volumenKg: 6480,
      duracionMin: 51,
    },
    {
      id: "s-2",
      fecha: "2026-10-14T13:00:00.000Z",
      rutinaNombre: "Piernas A",
      series: 16,
      volumenKg: 8120,
      duracionMin: 47,
    },
  ],
  peso: {
    mediciones: [
      { id: "m1", fecha: "2026-09-28T15:00:00.000Z", peso: 80 },
      { id: "m2", fecha: "2026-10-05T15:00:00.000Z", peso: 78.4 },
    ],
    pesoObjetivo: 77,
    pesoInicial: 80,
  },
};

const waitForLoadingComplete = () =>
  waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());

const asSocio = (extra: Record<string, unknown> = {}) =>
  mockAuth.mockReturnValue({ isAuthenticated: true, isMember: true, isStaff: false, ...extra });

describe("HomeSocioPage (sesión primero: recorrido + historial + números)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(baseViewModel);
  });

  it("redirige a /login sin sesión", () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isMember: false });
    render(<HomeSocioPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("redirige al staff a /home-interno", () => {
    mockAuth.mockReturnValue({ isAuthenticated: true, isMember: false, isStaff: true });
    render(<HomeSocioPage />);
    expect(mockPush).toHaveBeenCalledWith("/home-interno");
  });

  it("muestra el rail del socio con la zona de inicio activa", async () => {
    asSocio();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByTestId("nav-link-inicio")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("nav-link-rutina")).toHaveAttribute("data-active", "false");
    expect(screen.getByText("Entrenamiento")).toBeInTheDocument();
    expect(screen.getByText("Mi cuenta")).toBeInTheDocument();
  });

  it("la sesión de hoy es el recorrido con sus paradas y la actual marcada", async () => {
    asSocio();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    const recorrido = screen.getByTestId("recorrido-sesion");
    const paradas = recorrido.querySelectorAll("li");
    expect(paradas).toHaveLength(2);
    expect(paradas[0]).toHaveAttribute("data-estado", "actual");
    expect(paradas[1]).toHaveAttribute("data-estado", "pendiente");
    expect(screen.getByText("2 ejercicios")).toBeInTheDocument();
    expect(screen.getByText("7 series")).toBeInTheDocument();
  });

  it("usa la media real del ejercicio actual", async () => {
    asSocio();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByAltText("Press de Banca")).toHaveAttribute(
      "src",
      "/ejercicios/0001-2gPfomN.jpg"
    );
  });

  it("sin media cargada no rompe el hero", async () => {
    asSocio();
    mockFetch.mockResolvedValue({
      ...baseViewModel,
      rutinaActiva: { ...baseViewModel.rutinaActiva!, ejercicios: [{ ...baseViewModel.rutinaActiva!.ejercicios[0], mediaId: null }] },
    });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.queryByAltText("Press de Banca")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empezar entrenamiento/i })).toBeInTheDocument();
  });

  it("con una sesión en curso el CTA invita a retomar", async () => {
    asSocio();
    mockFetch.mockResolvedValue({
      ...baseViewModel,
      sesionEnProgreso: true,
      rutinaActiva: { ...baseViewModel.rutinaActiva!, indiceActual: 1 },
    });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByRole("button", { name: /retomar entrenamiento/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /empezar entrenamiento/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("recorrido-sesion").querySelectorAll("li")[0]).toHaveAttribute(
      "data-estado",
      "hecho"
    );
  });

  it("muestra el historial de sesiones con volumen y duración del servidor", async () => {
    asSocio();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    const historial = screen.getByTestId("ultimas-sesiones");
    expect(historial).toHaveTextContent("Torso B");
    expect(historial).toHaveTextContent("6.480 kg");
    expect(historial).toHaveTextContent("51 min");
    expect(historial).toHaveTextContent("12 asistencias en las últimas 4 semanas");
  });

  it("sin sesiones cerradas dice que todavía no hay ninguna", async () => {
    asSocio();
    mockFetch.mockResolvedValue({ ...baseViewModel, ultimasSesiones: [] });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByTestId("ultimas-sesiones")).toHaveTextContent(/todavía no cerraste ninguna sesión/i);
  });

  it("muestra la racha como tira semanal, no como número suelto", async () => {
    asSocio();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByTestId("racha-count")).toHaveTextContent("3");
    const celdas = screen.getAllByTestId("dia-celda");
    expect(celdas).toHaveLength(7);
    expect(celdas.filter((c) => c.getAttribute("data-estado") === "asistio")).toHaveLength(2);
    expect(celdas.filter((c) => c.getAttribute("data-estado") === "hoy")).toHaveLength(1);
  });

  it("muestra el progreso de carga con el valor y el delta del motor", async () => {
    asSocio();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    const progreso = screen.getByTestId("progreso-carga");
    expect(progreso).toHaveTextContent("Press de Banca");
    expect(progreso).toHaveTextContent("80");
    expect(screen.getByTestId("progreso-delta")).toHaveTextContent("+7,5 kg este mes");
  });

  it("muestra el aviso de reactivación arriba del contenido cuando el socio es elegible (D-54)", async () => {
    asSocio();
    mockFetch.mockResolvedValue({ ...baseViewModel, oferta: { descuentoPct: 10 } });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    const aviso = screen.getByTestId("aviso-oferta-reactivacion");
    expect(
      aviso.compareDocumentPosition(screen.getByTestId("recorrido-sesion")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("no muestra el aviso cuando el socio no es elegible", async () => {
    asSocio();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();
    expect(screen.queryByTestId("aviso-oferta-reactivacion")).not.toBeInTheDocument();
  });

  it("sin rutina asignada muestra el estado vacío propio", async () => {
    asSocio();
    mockFetch.mockResolvedValue({ ...baseViewModel, rutinaActiva: null });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByTestId("card-rutina")).toHaveTextContent(/sin rutina asignada/i);
    expect(screen.queryByText(/trabajando en esto/i)).not.toBeInTheDocument();
  });

  it("con datos vacíos no rompe: progreso, racha y peso tienen su propio estado", async () => {
    asSocio();
    mockFetch.mockResolvedValue({
      ...baseViewModel,
      progreso: null,
      membresia: null,
      ultimasSesiones: [],
    });
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    expect(screen.getByTestId("progreso-carga")).toHaveTextContent(/todavía no hay registros/i);
    expect(screen.getByTestId("tu-serie")).toBeInTheDocument();
    expect(screen.getByTestId("ultimas-sesiones")).toBeInTheDocument();
    expect(screen.queryByText(/trabajando en esto/i)).not.toBeInTheDocument();
  });

  it("muestra un error y no rompe cuando falla el fetch", async () => {
    asSocio();
    mockFetch.mockRejectedValue(new Error("network down"));
    render(<HomeSocioPage />);
    await waitFor(() =>
      expect(screen.getByText(/no pudimos cargar tu inicio/i)).toBeInTheDocument()
    );
  });

  it("'Empezar entrenamiento' abre la pantalla de ejecución (T-038)", async () => {
    asSocio();
    mockEnCurso.mockResolvedValueOnce({
      sesion: null,
      ejercicios: [],
      ultimaSerie: null,
      cargaActual: null,
      ultimasVeces: {},
      sugerencias: {},
      records: {},
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
        {
          id: "e1", nombre: "Press de Banca", series: 4, repeticiones: 8, descanso: 120, orden: 0,
          mediaId: null, musculoObjetivo: null, instrucciones: [],
        },
      ],
      ultimasVeces: {},
      sugerencias: {},
      records: {},
    });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /empezar entrenamiento/i }));

    expect(await screen.findByTestId("ejecucion-rutina")).toBeInTheDocument();
    expect(mockIniciar).toHaveBeenCalledWith("asig-1");
  });

  it("el botón de cerrar sesión del rail llama al logout del contexto", async () => {
    const logout = jest.fn();
    asSocio({ logout });
    const user = userEvent.setup();
    render(<HomeSocioPage />);
    await waitForLoadingComplete();

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
