/**
 * Pantalla "Configuración" (T-043c): muestra los parámetros agrupados, valida en el
 * cliente y guarda solo los campos que cambiaron contra PUT /api/configuracion.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfiguracionPage } from "./page";
import { useAuth } from "@/contexts/auth";
import { useNotifications } from "@/contexts/notifications";
import { fetchConfiguracion, guardarConfiguracion } from "@/api/configuracion";
import { fetchDispositivos } from "@/api/dispositivos";
import type { Configuracion } from "@/lib/configuracion";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/configuracion",
}));
jest.mock("@/contexts/auth");
jest.mock("@/contexts/notifications");
jest.mock("@/api/configuracion", () => ({
  fetchConfiguracion: jest.fn(),
  guardarConfiguracion: jest.fn(),
}));
jest.mock("@/api/dispositivos", () => ({
  fetchDispositivos: jest.fn(),
  crearDispositivo: jest.fn(),
  cambiarEstadoDispositivo: jest.fn(),
}));

const mockAuth = useAuth as jest.Mock;
const mockNotify = jest.fn();
const mockFetch = fetchConfiguracion as jest.MockedFunction<typeof fetchConfiguracion>;
const mockGuardar = guardarConfiguracion as jest.MockedFunction<typeof guardarConfiguracion>;
const mockFetchDispositivos = fetchDispositivos as jest.MockedFunction<typeof fetchDispositivos>;

const configBase: Configuracion = {
  capacidadMaxima: 100,
  periodoGracia: 5,
  diasInactividad: 15,
  ventanaAforoMinutos: 90,
  diaLimitePago: 10,
  diaCorteAltaTardia: 20,
  antiPassbackMinutos: 60,
  descuentoReactivacion: 10,
  ofertaReactivacionActiva: false,
  diasSinAsistirParaOferta: 30,
  enfriamientoOfertaDias: 180,
  segundosEjecucionSerie: 60,
  minutosVencimientoReserva: 15,
  minutosInactividadSesion: 30,
};

const asRol = (rol: string) => ({
  isAuthenticated: true,
  isMember: false,
  isStaff: true,
  user: { nombre: "Ana", rol },
});

const guardar = () => userEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

describe("ConfiguracionPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue(asRol("ADMINISTRADOR"));
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    mockFetch.mockResolvedValue(configBase);
    mockFetchDispositivos.mockResolvedValue([]);
  });

  it("renderiza los 14 campos una vez cargada", async () => {
    render(<ConfiguracionPage />);
    await waitFor(() => expect(screen.getAllByTestId(/^campo-/)).toHaveLength(14));
  });

  it("agrupa los campos con sus títulos", async () => {
    render(<ConfiguracionPage />);
    await screen.findByTestId("campo-capacidadMaxima");

    expect(screen.getByRole("heading", { name: "Acceso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cuotas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aforo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Oferta de reactivación" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Motor de espera" })).toBeInTheDocument();
  });

  it("redirige a /login cuando no hay sesión", () => {
    mockAuth.mockReturnValue({ isAuthenticated: false, isMember: false, isStaff: false, user: null });
    render(<ConfiguracionPage />);
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("un rol no autorizado ve Acceso Denegado y no carga", async () => {
    mockAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    render(<ConfiguracionPage />);
    expect(await screen.findByText("Acceso Denegado")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("muestra el banner de error si falla la carga", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));
    render(<ConfiguracionPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la configuración.");
  });

  it("guarda solo el campo que cambió y notifica el éxito", async () => {
    mockGuardar.mockResolvedValueOnce({ ...configBase, periodoGracia: 7 });
    render(<ConfiguracionPage />);

    const input = await screen.findByTestId("campo-periodoGracia");
    fireEvent.change(input, { target: { value: "7" } });
    await guardar();

    await waitFor(() => expect(mockGuardar).toHaveBeenCalledTimes(1));
    expect(mockGuardar).toHaveBeenCalledWith({ periodoGracia: 7 });
    expect(mockNotify).toHaveBeenCalledWith("success", "Configuración guardada.");
  });

  it("sin cambios no llama a la API y muestra una notificación neutra", async () => {
    render(<ConfiguracionPage />);
    await screen.findByTestId("campo-periodoGracia");
    await guardar();

    expect(mockGuardar).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith("info", expect.any(String));
  });

  it("un valor fuera de rango muestra la validación y no llama a la API", async () => {
    render(<ConfiguracionPage />);

    const input = await screen.findByTestId("campo-capacidadMaxima");
    fireEvent.change(input, { target: { value: "99999" } });
    await guardar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "capacidadMaxima debe estar entre 1 y 10000"
    );
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it("valida en el cliente segundosEjecucionSerie = 0", async () => {
    render(<ConfiguracionPage />);

    const input = await screen.findByTestId("campo-segundosEjecucionSerie");
    fireEvent.change(input, { target: { value: "0" } });
    await guardar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "segundosEjecucionSerie debe estar entre 1 y 3600"
    );
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it("valida en el cliente minutosInactividadSesion = 0", async () => {
    render(<ConfiguracionPage />);

    const input = await screen.findByTestId("campo-minutosInactividadSesion");
    fireEvent.change(input, { target: { value: "0" } });
    await guardar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "minutosInactividadSesion debe estar entre 1 y 1440"
    );
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it("guarda minutosInactividadSesion = 45 y notifica el éxito", async () => {
    mockGuardar.mockResolvedValueOnce({ ...configBase, minutosInactividadSesion: 45 });
    render(<ConfiguracionPage />);

    const input = await screen.findByTestId("campo-minutosInactividadSesion");
    fireEvent.change(input, { target: { value: "45" } });
    await guardar();

    await waitFor(() => expect(mockGuardar).toHaveBeenCalledTimes(1));
    expect(mockGuardar).toHaveBeenCalledWith({ minutosInactividadSesion: 45 });
    expect(mockNotify).toHaveBeenCalledWith("success", "Configuración guardada.");
  });

  it("un segundo guardado sin cambios es no-op tras actualizar la línea base", async () => {
    mockGuardar.mockResolvedValueOnce({ ...configBase, periodoGracia: 7 });
    render(<ConfiguracionPage />);

    const input = await screen.findByTestId("campo-periodoGracia");
    fireEvent.change(input, { target: { value: "7" } });
    await guardar();
    await waitFor(() => expect(mockGuardar).toHaveBeenCalledTimes(1));

    mockNotify.mockClear();
    await guardar();

    expect(mockGuardar).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith("info", expect.any(String));
  });

  it("muestra el error del servidor si falla el guardado", async () => {
    mockGuardar.mockRejectedValueOnce(new Error("boom"));
    render(<ConfiguracionPage />);

    const input = await screen.findByTestId("campo-periodoGracia");
    fireEvent.change(input, { target: { value: "7" } });
    await guardar();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la configuración.");
  });

  describe("Pestañas", () => {
    it("arranca en Parámetros con su formulario", async () => {
      render(<ConfiguracionPage />);
      await waitFor(() => expect(screen.getAllByTestId(/^campo-/)).toHaveLength(14));
      expect(screen.getByRole("tab", { name: "Parámetros" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "tab-parametros");
    });

    it("monta el panel de Dispositivos en su pestaña", async () => {
      const user = userEvent.setup();
      mockFetchDispositivos.mockResolvedValueOnce([
        {
          id: "dev-1",
          nombre: "Puerta principal",
          tipo: "PUERTA",
          estado: "ACTIVO",
          ultimoContacto: null,
          createdAt: new Date(),
        },
      ]);
      render(<ConfiguracionPage />);
      await screen.findByTestId("campo-periodoGracia");

      await user.click(screen.getByRole("tab", { name: "Dispositivos" }));

      expect(await screen.findByText("Puerta principal")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Dispositivos" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "tab-dispositivos");
    });
  });
});
