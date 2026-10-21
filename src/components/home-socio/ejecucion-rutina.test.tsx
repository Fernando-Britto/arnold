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

  it("ofrece tres tipos y arranca en Normal: el drop set no es un tipo, se agrega a la serie (P-46, D-69)", async () => {
    await abrir();

    const botones = within(tipoGrupo()).getAllByRole("button");
    expect(botones.map((b) => b.textContent)).toEqual(["Normal", "Calentamiento", "Al fallo"]);
    expect(opcion(/^normal$/i)).toHaveAttribute("aria-pressed", "true");
    expect(opcion(/^calentamiento$/i)).toHaveAttribute("aria-pressed", "false");
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

    await user.click(opcion(/^normal$/i));
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

describe("EjecucionRutina: encabezado de la sesión (T-049, D-67)", () => {
  const ahoraFijo = new Date("2026-10-12T13:12:34.000Z"); // 12 min 34 s después de ISO (13:00:00)

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(ahoraFijo);
  });
  afterEach(() => jest.useRealTimers());

  const sentadilla = { id: "ej-2", nombre: "Sentadilla", series: 3, repeticiones: 8, descanso: 120, orden: 1 };

  async function abrir(detalle: Record<string, unknown> = {}, ejercicioEnPantalla = "Press banca") {
    mockEnCurso.mockResolvedValueOnce(detalleEnCurso(detalle) as never);
    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText(ejercicioEnPantalla);
  }

  it("al retomar muestra el ejercicio, las series hechas y el tiempo desde que empezó", async () => {
    // Press banca 4 series, va por la 2: 1 hecha de 4.
    await abrir();

    expect(screen.getByTestId("sesion-ejercicio")).toHaveTextContent("Ejercicio 1 de 1");
    expect(screen.getByTestId("sesion-series")).toHaveTextContent("1/4 series");
    expect(screen.getByTestId("sesion-tiempo")).toHaveTextContent("12:34");
  });

  it("con varios ejercicios cuenta las series de los anteriores", async () => {
    await abrir(
      {
        ejercicios: [ejercicio, sentadilla],
        sesion: {
          id: "s1",
          socioId: "socio-1",
          rutinaAsignadaId: "asig-1",
          estadoDeFinalizacion: "EN_CURSO",
          horaInicio: ISO,
          ejercicioActualId: "ej-2",
          serieActual: 2,
        },
      },
      "Sentadilla"
    );

    expect(screen.getByTestId("sesion-ejercicio")).toHaveTextContent("Ejercicio 2 de 2");
    expect(screen.getByTestId("sesion-series")).toHaveTextContent("5/7 series");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
  });

  it("el reloj avanza solo, cada segundo, sin tocar nada", async () => {
    await abrir();
    expect(screen.getByTestId("sesion-tiempo")).toHaveTextContent("12:34");

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(screen.getByTestId("sesion-tiempo")).toHaveTextContent("12:39");
  });

  it("al registrar una serie suben el contador y la barra", async () => {
    mockRegistrar.mockResolvedValueOnce({
      registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: 2, carga: 40, repeticiones: 10, rir: 2 },
      sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 3 },
    } as never);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrir();

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(await screen.findByText("2/4 series")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });

  it("un calentamiento no hace avanzar el contador de series", async () => {
    mockRegistrar.mockResolvedValueOnce({
      registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: null, carga: 20, repeticiones: 10, rir: null },
      sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 2 },
    } as never);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrir();

    await user.click(screen.getByRole("button", { name: /^calentamiento$/i }));
    await user.click(screen.getByRole("button", { name: /calentamiento hecho/i }));

    expect(await screen.findByTestId("calentamientos")).toBeInTheDocument();
    expect(screen.getByTestId("sesion-series")).toHaveTextContent("1/4 series");
  });

  it("al pasar al ejercicio siguiente cambia el número de ejercicio", async () => {
    mockRegistrar.mockResolvedValueOnce({
      registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: 4, carga: 40, repeticiones: 10, rir: 2 },
      sesion: { id: "s1", ejercicioActualId: "ej-2", serieActual: 1 },
    } as never);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrir({
      ejercicios: [ejercicio, sentadilla],
      sesion: {
        id: "s1",
        socioId: "socio-1",
        rutinaAsignadaId: "asig-1",
        estadoDeFinalizacion: "EN_CURSO",
        horaInicio: ISO,
        ejercicioActualId: "ej-1",
        serieActual: 4,
      },
    });
    expect(screen.getByTestId("sesion-ejercicio")).toHaveTextContent("Ejercicio 1 de 2");

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByTestId("sesion-ejercicio")).toHaveTextContent("Ejercicio 2 de 2");
    expect(screen.getByTestId("sesion-series")).toHaveTextContent("4/7 series");
  });

  it("en una sesión nueva arranca en 0 series y el reloj en 0:00", async () => {
    mockEnCurso.mockResolvedValueOnce(sinSesion as never);
    mockIniciar.mockResolvedValueOnce(
      sesionIniciada({
        sesion: {
          id: "s9",
          rutinaAsignadaId: "asig-1",
          estadoDeFinalizacion: "EN_CURSO",
          horaInicio: ahoraFijo.toISOString(),
          ejercicioActualId: "ej-1",
          serieActual: 1,
        },
      }) as never
    );

    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");

    expect(screen.getByTestId("sesion-series")).toHaveTextContent("0/4 series");
    expect(screen.getByTestId("sesion-tiempo")).toHaveTextContent("0:00");
  });

  it("el reloj de la sesión no interfiere con el cronómetro de descanso", async () => {
    mockRegistrar.mockResolvedValueOnce({
      registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: 2, carga: 40, repeticiones: 10, rir: 2 },
      sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual: 3 },
    } as never);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await abrir();

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));
    await screen.findByText("2/4 series");
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId("sesion-tiempo")).toHaveTextContent("12:44");
    expect(screen.getByTestId("descanso-tiempo")).toBeInTheDocument();
  });
});

describe("EjecucionRutina: drop sets colgados de la serie (P-46, D-69)", () => {
  beforeEach(() => jest.clearAllMocks());

  const registrada = (serieActual = 3) => ({
    registro: { id: "r1", fecha: new Date().toISOString(), numeroSerie: 2, carga: 40, repeticiones: 10, rir: 2 },
    sesion: { id: "s1", ejercicioActualId: "ej-1", serieActual },
    drops: [],
  });

  async function abrir(detalle: Record<string, unknown> = {}) {
    mockEnCurso.mockResolvedValueOnce(
      detalleEnCurso({ cargaActual: { carga: 40, repeticiones: 10, rir: 2, fecha: ISO }, ...detalle }) as never
    );
    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Press banca");
  }

  const agregar = () => screen.getByRole("button", { name: /agregar drop set/i });

  it("ofrece agregar un drop set a la serie, sin filas al principio", async () => {
    await abrir();

    expect(agregar()).toBeEnabled();
    expect(screen.queryByRole("group", { name: /drop 1/i })).not.toBeInTheDocument();
  });

  it("un drop nuevo parte de un 20 % menos que la carga de la serie y de sus mismas repeticiones", async () => {
    const user = userEvent.setup();
    await abrir();

    await user.click(agregar());

    expect(screen.getByTestId("valor-carga-drop-1")).toHaveTextContent("32.5");
    expect(screen.getByTestId("valor-repeticiones-drop-1")).toHaveTextContent("10");
  });

  it("la serie se registra con sus drops en UNA sola petición", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada() as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(agregar());
    await user.click(agregar());
    await user.click(screen.getByRole("button", { name: /sumar repeticiones del drop 2/i }));
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(mockRegistrar).toHaveBeenCalledTimes(1);
    expect(mockRegistrar).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        carga: 40,
        repeticiones: 10,
        drops: [
          { carga: 32.5, repeticiones: 10 },
          { carga: 25, repeticiones: 11 },
        ],
      })
    );
  });

  it("sin drops la petición no lleva el campo (igual que antes)", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada() as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(mockRegistrar.mock.calls[0][1]).not.toHaveProperty("drops");
  });

  it("los drops no mueven la serie: avanza una sola, y las filas desaparecen al registrar", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada(3) as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(agregar());
    await user.click(agregar());
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(await screen.findByText(/serie 3 de 4/i)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /drop 1/i })).not.toBeInTheDocument();
  });

  it("registrar la serie con drops arranca UN solo descanso, no uno por drop", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada() as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(agregar());
    await user.click(agregar());
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(await screen.findAllByTestId("descanso-tiempo")).toHaveLength(1);
  });

  it("también se agregan a una serie hasta el fallo", async () => {
    mockRegistrar.mockResolvedValueOnce(registrada() as never);
    const user = userEvent.setup();
    await abrir();

    await user.click(within(screen.getByRole("group", { name: /tipo de serie/i })).getByRole("button", { name: /al fallo/i }));
    await user.click(agregar());
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(mockRegistrar).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ tipo: "HASTA_EL_FALLO", drops: [{ carga: 32.5, repeticiones: 10 }] })
    );
  });

  it("un calentamiento no lleva drops: se ocultan y se descartan, también si se vuelve a Normal", async () => {
    const user = userEvent.setup();
    await abrir();
    await user.click(agregar());
    expect(screen.getByRole("group", { name: /drop 1/i })).toBeInTheDocument();

    await user.click(within(screen.getByRole("group", { name: /tipo de serie/i })).getByRole("button", { name: /^calentamiento$/i }));
    expect(screen.queryByRole("button", { name: /agregar drop set/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /drop 1/i })).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("group", { name: /tipo de serie/i })).getByRole("button", { name: /^normal$/i }));
    expect(screen.queryByRole("group", { name: /drop 1/i })).not.toBeInTheDocument();
    expect(agregar()).toBeInTheDocument();
  });

  it("si el servidor rechaza la serie, los drops quedan para reintentar", async () => {
    mockRegistrar.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    await abrir();

    await user.click(agregar());
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("group", { name: /drop 1/i })).toBeInTheDocument();
  });

  it("el máximo de drops por serie se respeta en la pantalla", async () => {
    const user = userEvent.setup();
    await abrir();

    for (let i = 0; i < 5; i++) await user.click(agregar());

    expect(agregar()).toBeDisabled();
  });

  it("al pasar al ejercicio siguiente no quedan drops de la serie anterior", async () => {
    const sentadilla = { id: "ej-2", nombre: "Sentadilla", series: 3, repeticiones: 8, descanso: 120, orden: 1 };
    mockRegistrar.mockResolvedValueOnce({
      ...registrada(),
      sesion: { id: "s1", ejercicioActualId: "ej-2", serieActual: 1 },
    } as never);
    const user = userEvent.setup();
    await abrir({
      ejercicios: [ejercicio, sentadilla],
      sesion: {
        id: "s1",
        socioId: "socio-1",
        rutinaAsignadaId: "asig-1",
        estadoDeFinalizacion: "EN_CURSO",
        horaInicio: ISO,
        ejercicioActualId: "ej-1",
        serieActual: 4,
      },
    });

    await user.click(agregar());
    await user.click(screen.getByRole("button", { name: /serie hecha/i }));

    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /drop 1/i })).not.toBeInTheDocument();
  });
});
