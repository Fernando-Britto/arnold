/**
 * Pantalla de ejecución de la rutina (T-038, D-48): precarga la prescripción, steppers de
 * repeticiones y peso, selector de RIR, "Serie hecha" contra la API y cronómetro de descanso
 * calculado con la hora guardada (sobrevive a recargas).
 */
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjecucionRutina } from "./ejecucion-rutina";
import {
  fetchSesionEnCurso,
  iniciarSesionDeEntrenamiento,
  registrarSerieDeEntrenamiento,
  finalizarSesionDeEntrenamiento,
} from "@/api/sesiones";

jest.mock("@/api/sesiones");

const mockEnCurso = fetchSesionEnCurso as jest.MockedFunction<typeof fetchSesionEnCurso>;
const mockIniciar = iniciarSesionDeEntrenamiento as jest.MockedFunction<
  typeof iniciarSesionDeEntrenamiento
>;
const mockRegistrar = registrarSerieDeEntrenamiento as jest.MockedFunction<
  typeof registrarSerieDeEntrenamiento
>;
const mockFinalizar = finalizarSesionDeEntrenamiento as jest.MockedFunction<
  typeof finalizarSesionDeEntrenamiento
>;

const ISO = "2026-10-12T13:00:00.000Z";

const ejercicio = {
  id: "ej-1",
  nombre: "Press banca",
  series: 4,
  repeticiones: 10,
  descanso: 90,
  orden: 0,
};

/** Detalle de una sesión en curso retomable. */
function detalleEnCurso(overrides: Record<string, unknown> = {}) {
  return {
    sesion: {
      id: "s1",
      socioId: "socio-1",
      rutinaAsignadaId: "asig-1",
      estadoDeFinalizacion: "EN_CURSO",
      horaInicio: ISO,
      ejercicioActualId: "ej-1",
      serieActual: 2,
    },
    ejercicios: [ejercicio],
    ultimaSerie: null,
    cargaActual: null,
    ...overrides,
  };
}

const sinSesion = {
  sesion: null,
  ejercicios: [],
  ultimaSerie: null,
  cargaActual: null,
};

/** Respuesta de iniciar una sesión nueva. */
function sesionIniciada(overrides: Record<string, unknown> = {}) {
  return {
    sesion: {
      id: "s1",
      rutinaAsignadaId: "asig-1",
      estadoDeFinalizacion: "EN_CURSO",
      horaInicio: ISO,
      ejercicioActualId: "ej-1",
      serieActual: 1,
    },
    ejercicios: [ejercicio],
    ...overrides,
  };
}

describe("EjecucionRutina", () => {
  beforeEach(() => jest.clearAllMocks());

  it("al retomar, precarga la prescripción y la última carga registrada", async () => {
    mockEnCurso.mockResolvedValueOnce(
      detalleEnCurso({
        cargaActual: { carga: 42.5, repeticiones: 9, rir: 1, fecha: ISO },
      }) as never
    );

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);

    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.getByTestId("valor-repeticiones")).toHaveTextContent("9");
    expect(screen.getByTestId("valor-carga")).toHaveTextContent("42.5");
    expect(screen.getByRole("button", { name: "RIR 1" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(mockIniciar).not.toHaveBeenCalled();
  });

  it("inicia una sesión nueva con el rutinaAsignadaId cuando no hay ninguna en curso", async () => {
    mockEnCurso.mockResolvedValueOnce(sinSesion as never);
    mockIniciar.mockResolvedValueOnce(sesionIniciada() as never);

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);

    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(mockIniciar).toHaveBeenCalledWith("asig-1");
    expect(screen.getByTestId("valor-repeticiones")).toHaveTextContent("10");
    expect(screen.getByTestId("valor-carga")).toHaveTextContent("0");
  });

  it("los steppers suman y restan una repetición y un disco de peso (2.5 kg)", async () => {
    const user = userEvent.setup();
    mockEnCurso.mockResolvedValueOnce(
      detalleEnCurso({ cargaActual: { carga: 40, repeticiones: 8, rir: null, fecha: ISO } }) as never
    );

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");

    await user.click(screen.getByRole("button", { name: /sumar una repetición/i }));
    expect(screen.getByTestId("valor-repeticiones")).toHaveTextContent("9");
    await user.click(screen.getByRole("button", { name: /restar una repetición/i }));
    expect(screen.getByTestId("valor-repeticiones")).toHaveTextContent("8");

    await user.click(screen.getByRole("button", { name: /sumar peso/i }));
    expect(screen.getByTestId("valor-carga")).toHaveTextContent("42.5");
    await user.click(screen.getByRole("button", { name: /restar peso/i }));
    expect(screen.getByTestId("valor-carga")).toHaveTextContent("40");
  });

  it("permite elegir el RIR de 0 a 5", async () => {
    const user = userEvent.setup();
    mockEnCurso.mockResolvedValueOnce(detalleEnCurso() as never);

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");

    await user.click(screen.getByRole("button", { name: "RIR 3" }));

    expect(screen.getByRole("button", { name: "RIR 3" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "RIR 1" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it('registra la serie, arranca el cronómetro y "saltar" lo corta', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockEnCurso.mockResolvedValueOnce(sinSesion as never);
    mockIniciar.mockResolvedValueOnce(sesionIniciada() as never);
    mockRegistrar.mockResolvedValueOnce({
      registro: {
        id: "reg-1",
        fecha: new Date().toISOString(),
        numeroSerie: 1,
        carga: 40,
        repeticiones: 10,
        rir: 2,
      },
      sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 2 },
    } as never);

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(mockRegistrar).toHaveBeenCalledWith("s1", {
      ejercicioId: "ej-1",
      carga: 0,
      repeticiones: 10,
      rir: 2,
    });
    expect(await screen.findByTestId("descanso-tiempo")).toHaveTextContent("1:30");

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId("descanso-tiempo")).toHaveTextContent("1:20");

    await user.click(screen.getByRole("button", { name: /saltar/i }));
    expect(screen.queryByTestId("descanso-tiempo")).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it("al completar la última serie finaliza la sesión y muestra el resumen", async () => {
    const user = userEvent.setup();
    mockEnCurso.mockResolvedValueOnce(sinSesion as never);
    mockIniciar.mockResolvedValueOnce(sesionIniciada() as never);
    mockRegistrar.mockResolvedValueOnce({
      registro: { id: "reg-1", fecha: ISO, numeroSerie: 4, carga: 40, repeticiones: 10, rir: 1 },
      sesion: { id: "s1", ejercicioActualId: null, serieActual: null },
    } as never);
    mockFinalizar.mockResolvedValueOnce({ id: "s1", estadoDeFinalizacion: "COMPLETADA" } as never);

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    await waitFor(() => expect(mockFinalizar).toHaveBeenCalledWith("s1"));
    expect(await screen.findByText(/rutina completada/i)).toBeInTheDocument();
  });
});
