/**
 * Pantalla de ejecución de la rutina (T-038, D-48): precarga la prescripción, steppers de
 * repeticiones y peso, selector de RIR, "Serie hecha" contra la API y cronómetro de descanso
 * calculado con la hora guardada (sobrevive a recargas).
 */
import React from "react";
import { render, screen, act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjecucionRutina } from "./ejecucion-rutina";
import {
  fetchSesionEnCurso,
  iniciarSesionDeEntrenamiento,
  registrarSerieDeEntrenamiento,
  finalizarSesionDeEntrenamiento,
  fetchResumenDeSesion,
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

const mockResumen = fetchResumenDeSesion as jest.MockedFunction<typeof fetchResumenDeSesion>;

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
  ultimasVeces: {},
  sugerencias: {},
};

/** Sugerencia (D-59): la última vez cumplió todas las repeticiones, hoy toca subir 2,5 kg. */
const subirPress = {
  tipo: "subir",
  carga: 42.5,
  motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg.",
};

/** Última vez (D-58): dos series de la sesión anterior de Press banca. */
const ultimaVezPress = {
  fecha: "2026-10-10T13:05:00.000Z",
  series: [
    { carga: 40, repeticiones: 10, rir: 3 },
    { carga: 42.5, repeticiones: 8, rir: 1 },
  ],
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

  describe("última vez (D-58)", () => {
    it("al retomar, muestra las series de la sesión anterior del ejercicio actual", async () => {
      mockEnCurso.mockResolvedValueOnce(
        detalleEnCurso({ ultimasVeces: { "ej-1": ultimaVezPress } }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.getByText(/última vez/i)).toBeInTheDocument();
      expect(
        screen.getAllByTestId("ultima-vez-serie").map((serie) => serie.textContent)
      ).toEqual(["40 kg × 10 · RIR 3", "42,5 kg × 8 · RIR 1"]);
      // Está en la serie 2: se resalta la equivalente de la última vez.
      expect(screen.getAllByTestId("ultima-vez-serie")[1]).toHaveAttribute("aria-current", "true");
    });

    it("sin historial del ejercicio dice que es la primera vez", async () => {
      mockEnCurso.mockResolvedValueOnce(detalleEnCurso({ ultimasVeces: {} }) as never);

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.getByText(/primera vez con este ejercicio/i)).toBeInTheDocument();
    });

    it("en una sesión nueva precarga la carga de la primera serie de la última vez", async () => {
      mockEnCurso.mockResolvedValueOnce(sinSesion as never);
      mockIniciar.mockResolvedValueOnce(
        sesionIniciada({ ultimasVeces: { "ej-1": ultimaVezPress } }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.getByTestId("valor-carga")).toHaveTextContent("40");
      // Las repeticiones siguen siendo las de la prescripción de la rutina.
      expect(screen.getByTestId("valor-repeticiones")).toHaveTextContent("10");
    });

    it("al retomar sin carga reciente, precarga la de la serie en curso de la última vez", async () => {
      mockEnCurso.mockResolvedValueOnce(
        detalleEnCurso({ cargaActual: null, ultimasVeces: { "ej-1": ultimaVezPress } }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      // serieActual = 2 → 42,5 (la serie 2 de la última vez).
      expect(screen.getByTestId("valor-carga")).toHaveTextContent("42.5");
    });

    it("al pasar al ejercicio siguiente muestra y precarga su última vez", async () => {
      const sentadilla = {
        id: "ej-2",
        nombre: "Sentadilla",
        series: 3,
        repeticiones: 8,
        descanso: 120,
        orden: 1,
      };
      const uno = { ...ejercicio, series: 1 };
      mockEnCurso.mockResolvedValueOnce(sinSesion as never);
      mockIniciar.mockResolvedValueOnce(
        sesionIniciada({
          ejercicios: [uno, sentadilla],
          ultimasVeces: {
            "ej-2": { fecha: "2026-10-09T13:00:00.000Z", series: [{ carga: 60, repeticiones: 8, rir: 2 }] },
          },
        }) as never
      );
      mockRegistrar.mockResolvedValueOnce({
        registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: 1, carga: 40, repeticiones: 10, rir: 2 },
        sesion: { id: "s1", ejercicioActualId: "ej-2", serieActual: 1 },
      } as never);
      const user = userEvent.setup();

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");
      await user.click(screen.getByRole("button", { name: /serie hecha/i }));

      expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
      expect(screen.getByTestId("valor-carga")).toHaveTextContent("60");
      expect(screen.getByText("60 kg × 8 · RIR 2")).toBeInTheDocument();
    });
  });

  describe("progresión sugerida (D-59)", () => {
    it("al retomar, muestra la carga sugerida con su motivo", async () => {
      mockEnCurso.mockResolvedValueOnce(
        detalleEnCurso({
          ultimasVeces: { "ej-1": ultimaVezPress },
          sugerencias: { "ej-1": subirPress },
        }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      const linea = screen.getByTestId("sugerencia-progresion");
      expect(linea).toHaveTextContent("Probá 42,5 kg");
      expect(linea).toHaveTextContent("+2,5 kg");
    });

    it("en una sesión nueva precarga la carga sugerida, no la de la última vez", async () => {
      mockEnCurso.mockResolvedValueOnce(sinSesion as never);
      mockIniciar.mockResolvedValueOnce(
        sesionIniciada({
          ultimasVeces: { "ej-1": ultimaVezPress },
          sugerencias: { "ej-1": subirPress },
        }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      // La última vez fue 40: la app precarga exactamente el número que dice sugerir.
      expect(screen.getByTestId("valor-carga")).toHaveTextContent("42.5");
    });

    it("si hay que mantener, cada serie repite la de la última vez", async () => {
      mockEnCurso.mockResolvedValueOnce(sinSesion as never);
      mockIniciar.mockResolvedValueOnce(
        sesionIniciada({
          ultimasVeces: { "ej-1": ultimaVezPress },
          sugerencias: {
            "ej-1": { tipo: "mantener", carga: 42.5, motivo: "Mismo peso otra vez." },
          },
        }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.getByTestId("valor-carga")).toHaveTextContent("40");
    });

    it("al retomar con una carga reciente, esa sigue mandando", async () => {
      mockEnCurso.mockResolvedValueOnce(
        detalleEnCurso({
          cargaActual: { carga: 50, repeticiones: 8, rir: 1, fecha: ISO },
          ultimasVeces: { "ej-1": ultimaVezPress },
          sugerencias: { "ej-1": subirPress },
        }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.getByTestId("valor-carga")).toHaveTextContent("50");
    });

    it("al pasar al ejercicio siguiente precarga y muestra su sugerencia", async () => {
      const sentadilla = {
        id: "ej-2",
        nombre: "Sentadilla",
        series: 3,
        repeticiones: 8,
        descanso: 120,
        orden: 1,
      };
      const uno = { ...ejercicio, series: 1 };
      mockEnCurso.mockResolvedValueOnce(sinSesion as never);
      mockIniciar.mockResolvedValueOnce(
        sesionIniciada({
          ejercicios: [uno, sentadilla],
          ultimasVeces: {
            "ej-2": { fecha: "2026-10-09T13:00:00.000Z", series: [{ carga: 60, repeticiones: 8, rir: 2 }] },
          },
          sugerencias: {
            "ej-2": { tipo: "subir", carga: 62.5, motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg." },
          },
        }) as never
      );
      mockRegistrar.mockResolvedValueOnce({
        registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: 1, carga: 40, repeticiones: 10, rir: 2 },
        sesion: { id: "s1", ejercicioActualId: "ej-2", serieActual: 1 },
      } as never);
      const user = userEvent.setup();

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");
      await user.click(screen.getByRole("button", { name: /serie hecha/i }));

      expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
      expect(screen.getByTestId("valor-carga")).toHaveTextContent("62.5");
      expect(screen.getByTestId("sugerencia-progresion")).toHaveTextContent("Probá 62,5 kg");
    });

    it("con una respuesta sin sugerencias (servidor viejo) no se rompe", async () => {
      mockEnCurso.mockResolvedValueOnce(
        detalleEnCurso({ ultimasVeces: { "ej-1": ultimaVezPress } }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.queryByTestId("sugerencia-progresion")).not.toBeInTheDocument();
      expect(screen.getByTestId("valor-carga")).toHaveTextContent("42.5");
    });
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

  describe("resumen al terminar (T-046b, D-62)", () => {
    const resumen = {
      sesionId: "s1",
      seriesHechas: 4,
      duracionMinutos: 45,
      ejercicios: [
        {
          ejercicioId: "ej-1",
          nombre: "Press banca",
          hoy: [{ carga: 42.5, repeticiones: 10, rir: 1 }],
          ultimaVez: { fecha: "2026-10-09T13:00:00.000Z", series: [{ carga: 40, repeticiones: 10, rir: 2 }] },
          tendencia: "subio",
          marcas: { carga: { valor: 42.5, anterior: 40 }, e1rm: null },
          proxima: { tipo: "subir", carga: 45, motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg." },
        },
      ],
    };

    /** Arranca una sesión de un solo ejercicio y hace la última serie. */
    async function terminarSesion() {
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
    }

    it("pide el resumen DESPUÉS de finalizar y lo muestra", async () => {
      mockResumen.mockResolvedValueOnce(resumen as never);

      await terminarSesion();

      expect(await screen.findByTestId("resumen-sesion")).toBeInTheDocument();
      expect(mockResumen).toHaveBeenCalledWith("s1");
      expect(mockFinalizar.mock.invocationCallOrder[0]).toBeLessThan(
        mockResumen.mock.invocationCallOrder[0]
      );
      expect(screen.getByTestId("sugerencia-progresion")).toHaveTextContent("Próxima vez: 45 kg");
      expect(screen.getByText(/rutina completada/i)).toBeInTheDocument();
    });

    it("muestra las marcas nuevas del ejercicio al terminar", async () => {
      mockResumen.mockResolvedValueOnce(resumen as never);

      await terminarSesion();

      expect(await screen.findByTestId("resumen-marca")).toHaveTextContent(
        "Nueva marca de carga: 42,5 kg (antes 40 kg)"
      );
    });

    it("con resumen no repite el conteo de series de la rutina", async () => {
      mockResumen.mockResolvedValueOnce(resumen as never);

      await terminarSesion();
      await screen.findByTestId("resumen-sesion");

      expect(screen.getByTestId("resumen-totales")).toHaveTextContent("4 series · 45 min");
      expect(screen.queryByText(/registraste/i)).not.toBeInTheDocument();
    });

    it("si el resumen falla, igual muestra que la rutina terminó", async () => {
      mockResumen.mockRejectedValueOnce(new Error("sin red"));

      await terminarSesion();

      expect(await screen.findByText(/rutina completada/i)).toBeInTheDocument();
      expect(screen.getByText(/registraste 4 series/i)).toBeInTheDocument();
      expect(screen.queryByTestId("resumen-sesion")).not.toBeInTheDocument();
    });

    it("sin ejercicios en el resumen muestra el mensaje de siempre", async () => {
      mockResumen.mockResolvedValueOnce({ ...resumen, ejercicios: [] } as never);

      await terminarSesion();

      expect(await screen.findByText(/registraste 4 series/i)).toBeInTheDocument();
      expect(screen.queryByTestId("resumen-sesion")).not.toBeInTheDocument();
    });
  });

  describe("récord en vivo (T-046c, D-63)", () => {
    it("muestra el récord a superar con la carga precargada", async () => {
      mockEnCurso.mockResolvedValueOnce(sinSesion as never);
      mockIniciar.mockResolvedValueOnce(
        sesionIniciada({
          ultimasVeces: { "ej-1": ultimaVezPress },
          records: { "ej-1": [{ carga: 40, repeticiones: 10 }] },
        }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.getByTestId("record-en-vivo")).toHaveTextContent("Récord a 40 kg: 10 reps");
    });

    it("se actualiza cuando cambia el peso: más pesado que todo, avisa la nueva marca", async () => {
      mockEnCurso.mockResolvedValueOnce(sinSesion as never);
      mockIniciar.mockResolvedValueOnce(
        sesionIniciada({
          ultimasVeces: { "ej-1": ultimaVezPress },
          records: { "ej-1": [{ carga: 40, repeticiones: 10 }] },
        }) as never
      );
      const user = userEvent.setup();

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");
      await user.click(screen.getByRole("button", { name: /sumar peso/i }));

      expect(screen.getByTestId("record-en-vivo")).toHaveAttribute("data-tipo", "nueva-carga");
      expect(screen.getByTestId("record-en-vivo")).toHaveTextContent("superás tu mejor marca (40 kg)");
    });

    it("al retomar con una carga reciente, compara con esa carga", async () => {
      mockEnCurso.mockResolvedValueOnce(
        detalleEnCurso({
          cargaActual: { carga: 50, repeticiones: 8, rir: 1, fecha: ISO },
          records: { "ej-1": [{ carga: 40, repeticiones: 12 }, { carga: 50, repeticiones: 6 }] },
        }) as never
      );

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.getByTestId("record-en-vivo")).toHaveTextContent("Récord a 50 kg: 6 reps");
    });

    it("con un servidor anterior que no manda récords, no se rompe ni muestra la línea", async () => {
      mockEnCurso.mockResolvedValueOnce(detalleEnCurso({}) as never);

      render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
      await screen.findByText("Press banca");

      expect(screen.queryByTestId("record-en-vivo")).not.toBeInTheDocument();
    });
  });
});

describe("EjecucionRutina: tipo de serie (T-047 parte 2, D-64)", () => {
  beforeEach(() => jest.clearAllMocks());

  const registrada = (over: Record<string, unknown> = {}) => ({
    registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: 2, carga: 40, repeticiones: 10, rir: 2 },
    // Sesión en la serie 3 de 4 (la 2 se acaba de hacer).
    sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 3 },
    ...over,
  });

  async function abrir(detalle: Record<string, unknown> = {}) {
    mockEnCurso.mockResolvedValueOnce(detalleEnCurso(detalle) as never);
    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");
  }

  const tipoGrupo = () => screen.getByRole("group", { name: /tipo de serie/i });
  const opcion = (nombre: RegExp) => within(tipoGrupo()).getByRole("button", { name: nombre });

  it("ofrece los cuatro tipos y arranca en Normal", async () => {
    await abrir();

    const botones = within(tipoGrupo()).getAllByRole("button");
    expect(botones.map((b) => b.textContent)).toEqual(["Normal", "Calentamiento", "Al fallo", "Drop set"]);
    expect(opcion(/^normal$/i)).toHaveAttribute("aria-pressed", "true");
    expect(opcion(/drop set/i)).toHaveAttribute("aria-pressed", "false");
  });

  it("una serie normal se registra sin `tipo` (como siempre)", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada() as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(mockRegistrar).toHaveBeenCalledWith(
      "s1",
      expect.not.objectContaining({ tipo: expect.anything() })
    );
  });

  it("un drop set se registra con su tipo, no avanza la serie ni dispara descanso", async () => {
    // El servidor no mueve la sesión: el drop cuelga de la serie 2.
    mockRegistrar.mockResolvedValueOnce(
      registrada({ sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 2 } }) as never
    );
    const user = userEvent.setup();
    await abrir();

    await user.click(opcion(/drop set/i));
    expect(opcion(/drop set/i)).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(mockRegistrar).toHaveBeenCalledWith("s1", expect.objectContaining({ tipo: "DROP_SET" }));
    expect(await screen.findByText(/serie 2 de 4/i)).toBeInTheDocument();
    expect(screen.queryByText(/descanso/i)).not.toBeInTheDocument();
    expect(opcion(/^normal$/i)).toHaveAttribute("aria-pressed", "true");
  });

  it("elegir 'Al fallo' pone el RIR en 0 y registra el tipo", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada() as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(opcion(/al fallo/i));

    expect(screen.getByRole("button", { name: "RIR 0" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));
    expect(mockRegistrar).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ tipo: "HASTA_EL_FALLO", rir: 0 })
    );
  });

  it("después de una serie al fallo el RIR vuelve a su valor por defecto (el 0 lo puso el tipo)", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada() as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(opcion(/al fallo/i));
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(await screen.findByText(/serie 3 de 4/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "RIR 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("el calentamiento no avanza la serie, se cuenta aparte y avisa que no es de la rutina", async () => {
    // El servidor no mueve la sesión: sigue en la serie 2 de 4.
    mockRegistrar.mockResolvedValueOnce(
      registrada({ sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 2 } }) as never
    );
    const user = userEvent.setup();
    await abrir();

    await user.click(opcion(/calentamiento/i));
    expect(screen.getByText(/no cuenta como una de las series de la rutina/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /calentamiento hecho/i }));

    expect(mockRegistrar).toHaveBeenCalledWith("s1", expect.objectContaining({ tipo: "CALENTAMIENTO" }));
    expect(await screen.findByText(/serie 2 de 4/i)).toBeInTheDocument();
    expect(screen.getByTestId("calentamientos")).toHaveTextContent("Calentamientos: 1");
    expect(opcion(/^normal$/i)).toHaveAttribute("aria-pressed", "true");
  });

  it("sin calentamientos hechos no muestra el contador", async () => {
    await abrir();

    expect(screen.queryByTestId("calentamientos")).not.toBeInTheDocument();
  });

  it("un calentamiento no puede ser un récord: la línea en vivo se oculta mientras está elegido", async () => {
    const user = userEvent.setup();
    await abrir({
      cargaActual: { carga: 40, repeticiones: 10, rir: 2, fecha: ISO },
      records: { "ej-1": [{ carga: 40, repeticiones: 10 }] },
    });
    expect(screen.getByTestId("record-en-vivo")).toBeInTheDocument();

    await user.click(opcion(/calentamiento/i));
    expect(screen.queryByTestId("record-en-vivo")).not.toBeInTheDocument();

    await user.click(opcion(/drop set/i));
    expect(screen.getByTestId("record-en-vivo")).toBeInTheDocument();
  });

  it("al pasar al ejercicio siguiente el contador de calentamientos empieza de cero", async () => {
    const sentadilla = { id: "ej-2", nombre: "Sentadilla", series: 3, repeticiones: 8, descanso: 120, orden: 1 };
    mockRegistrar
      .mockResolvedValueOnce(
        registrada({ sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 4 } }) as never
      )
      .mockResolvedValueOnce(
        registrada({ sesion: { id: "s1", ejercicioActualId: "ej-2", serieActual: 1 } }) as never
      );
    mockEnCurso.mockResolvedValueOnce(
      detalleEnCurso({ ejercicios: [ejercicio, sentadilla] }) as never
    );
    const user = userEvent.setup();

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");
    await user.click(opcion(/calentamiento/i));
    await user.click(screen.getByRole("button", { name: /calentamiento hecho/i }));
    expect(await screen.findByTestId("calentamientos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.queryByTestId("calentamientos")).not.toBeInTheDocument();
  });
});

