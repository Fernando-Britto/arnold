/**
 * Animación e instrucciones del ejercicio durante la sesión (T-050f, D-70): el socio ve cómo se
 * hace el ejercicio que tiene delante sin salir de la pantalla de ejecución.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { EjecucionRutina } from "./ejecucion-rutina";
import { fetchSesionEnCurso } from "@/api/sesiones";

jest.mock("@/api/sesiones");
const mockEnCurso = fetchSesionEnCurso as jest.MockedFunction<typeof fetchSesionEnCurso>;

const ISO = "2026-10-12T13:00:00.000Z";

const base = { series: 3, repeticiones: 12, descanso: 60 };
const curl = {
  id: "ej-1", nombre: "Curl de bíceps con mancuernas", orden: 0, ...base,
  mediaId: "0294-NbVPDMW", musculoObjetivo: "Bíceps",
  instrucciones: ["Párate con una mancuerna en cada mano.", "Flexiona los codos."],
};
const sentadilla = {
  id: "ej-2", nombre: "Sentadilla con barra", orden: 1, ...base,
  mediaId: "0043-XyZ", musculoObjetivo: "Cuádriceps", instrucciones: ["Baja controlando."],
};
const aMano = {
  id: "ej-3", nombre: "Ejercicio propio", orden: 2, ...base, mediaId: null, musculoObjetivo: null, instrucciones: [],
};

/** Sesión en curso con `actual` como ejercicio que se está haciendo. */
function enCurso(actual: string, ejercicios: unknown[]) {
  return {
    sesion: {
      id: "s1", socioId: "socio-1", rutinaAsignadaId: "asig-1", estadoDeFinalizacion: "EN_CURSO",
      horaInicio: ISO, ejercicioActualId: actual, serieActual: 1,
    },
    ejercicios,
    ultimaSerie: null,
    cargaActual: null,
    ultimasVeces: {},
    sugerencias: {},
    records: {},
  } as never;
}

beforeEach(() => mockEnCurso.mockReset());

describe("EjecucionRutina con la animación del ejercicio", () => {
  it("muestra la animación y el músculo principal del ejercicio actual", async () => {
    mockEnCurso.mockResolvedValueOnce(enCurso("ej-1", [curl, sentadilla]));
    const { container } = render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Curl de bíceps con mancuernas");

    expect(container.querySelector("video")).toHaveAttribute("src", "/ejercicios/0294-NbVPDMW.mp4");
    expect(screen.getByText("Bíceps")).toBeInTheDocument();
  });

  it("al retomar en otro ejercicio muestra la animación de ese y no la del primero", async () => {
    mockEnCurso.mockResolvedValueOnce(enCurso("ej-2", [curl, sentadilla]));
    const { container } = render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Sentadilla con barra");

    expect(container.querySelector("video")).toHaveAttribute("src", "/ejercicios/0043-XyZ.mp4");
    expect(container.querySelectorAll("video")).toHaveLength(1);
  });

  it("las instrucciones van en un desplegable cerrado, numeradas, para no tapar el registro de series", async () => {
    mockEnCurso.mockResolvedValueOnce(enCurso("ej-1", [curl]));
    const { container } = render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Curl de bíceps con mancuernas");

    const desplegable = container.querySelector("details")!;
    expect(desplegable).not.toHaveAttribute("open");
    expect(within(desplegable).getByText("Cómo se hace")).toBeInTheDocument();
    const pasos = within(desplegable).getAllByRole("listitem", { hidden: true });
    expect(pasos.map((p) => p.textContent)).toEqual(["Párate con una mancuerna en cada mano.", "Flexiona los codos."]);
  });

  it("muestra la atribución a Gym visual una sola vez", async () => {
    mockEnCurso.mockResolvedValueOnce(enCurso("ej-1", [curl, sentadilla]));
    render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Curl de bíceps con mancuernas");
    expect(screen.getAllByRole("link", { name: /gym visual/i })).toHaveLength(1);
  });

  it("un ejercicio cargado a mano queda como antes: sin video, sin desplegable, sin atribución", async () => {
    mockEnCurso.mockResolvedValueOnce(enCurso("ej-3", [aMano]));
    const { container } = render(<EjecucionRutina rutinaAsignadaId="asig-1" />);
    await screen.findByText("Ejercicio propio");

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(screen.queryByText(/gym visual/i)).toBeNull();
    expect(screen.queryByText(/sin animación disponible/i)).toBeNull();
  });
});
