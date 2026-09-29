import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgresoSection, esPersonalRecord, type PuntoProgreso } from "./progreso-section";

const progresion: PuntoProgreso[] = [
  { fecha: "2026-05-12", carga: 60 },
  { fecha: "2026-06-15", carga: 65 },
  { fecha: "2026-09-26", carga: 80 },
];

describe("esPersonalRecord", () => {
  it("is true when the current mark is the highest in the series", () => {
    expect(esPersonalRecord(progresion, 80)).toBe(true);
  });

  it("is false when an earlier point is higher than the current mark", () => {
    expect(esPersonalRecord(progresion, 62)).toBe(false);
  });

  it("is true with an empty series (nothing to beat)", () => {
    expect(esPersonalRecord([], 40)).toBe(true);
  });
});

describe("ProgresoSection (spec: matches Home_Socio_1x §Mi progreso)", () => {
  it("shows the exercise name, current mark, and monthly delta", () => {
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={80}
        deltaEsteMes={7.5}
        progresionCarga={progresion}
        proximaSesionSugerida={82.5}
      />
    );
    expect(screen.getByText("Press de Banca")).toBeInTheDocument();
    expect(screen.getByTestId("marca-actual")).toHaveTextContent("80 kg");
    expect(screen.getByText("Tu marca actual")).toBeInTheDocument();
    expect(screen.getByText("+7,5 kg este mes")).toBeInTheDocument();
  });

  it('shows a "PR" badge when the current mark is a personal record', () => {
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={80}
        deltaEsteMes={7.5}
        progresionCarga={progresion}
        proximaSesionSugerida={82.5}
      />
    );
    expect(screen.getByText("PR")).toBeInTheDocument();
  });

  it('hides the "PR" badge when the current mark is not a record', () => {
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={62}
        deltaEsteMes={2}
        progresionCarga={progresion}
        proximaSesionSugerida={64}
      />
    );
    expect(screen.queryByText("PR")).not.toBeInTheDocument();
  });

  it("renders the progression line and the Hoy time-axis label", () => {
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={80}
        deltaEsteMes={7.5}
        progresionCarga={progresion}
        proximaSesionSugerida={82.5}
      />
    );
    expect(screen.getByTestId("progreso-linea")).toBeInTheDocument();
    expect(screen.getByText("Hoy")).toBeInTheDocument();
  });

  it('shows "Próxima sesión sugerida" with the suggested weight and the increment', () => {
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={80}
        deltaEsteMes={7.5}
        progresionCarga={progresion}
        proximaSesionSugerida={82.5}
      />
    );
    expect(screen.getByText(/próxima sesión sugerida/i)).toBeInTheDocument();
    expect(screen.getByText("82,5 kg")).toBeInTheDocument();
    expect(screen.getByText("(+2,5 kg)")).toBeInTheDocument();
  });

  it("shows an empty state and hides the chart/footer when there is no history", () => {
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={0}
        deltaEsteMes={0}
        progresionCarga={[]}
        proximaSesionSugerida={0}
      />
    );
    expect(screen.getByText(/todav.a no registraste entrenamientos/i)).toBeInTheDocument();
    expect(screen.queryByTestId("progreso-linea")).not.toBeInTheDocument();
    expect(screen.queryByText(/próxima sesión sugerida/i)).not.toBeInTheDocument();
  });

  it("calls onVerTodosLosEjercicios when the link is clicked", async () => {
    const onVer = jest.fn();
    const user = userEvent.setup();
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={80}
        deltaEsteMes={7.5}
        progresionCarga={progresion}
        proximaSesionSugerida={82.5}
        onVerTodosLosEjercicios={onVer}
      />
    );
    await user.click(screen.getByText(/ver todos los ejercicios/i));
    expect(onVer).toHaveBeenCalledTimes(1);
  });
});
