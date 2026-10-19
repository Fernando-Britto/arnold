import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SugerenciaProgresoDTO } from "@/api/home-socio";
import { ProgresoSection, esPersonalRecord, type PuntoProgreso } from "./progreso-section";

const subir: SugerenciaProgresoDTO = {
  tipo: "subir",
  carga: 82.5,
  motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg.",
};

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
        sugerencia={subir}
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
        sugerencia={subir}
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
        sugerencia={{ ...subir, carga: 64 }}
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
        sugerencia={subir}
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
        sugerencia={subir}
      />
    );
    expect(screen.getByText(/próxima sesión sugerida/i)).toBeInTheDocument();
    expect(screen.getByText("82,5 kg")).toBeInTheDocument();
    expect(screen.getByText("(+2,5 kg)")).toBeInTheDocument();
  });

  describe("sugerencia del motor de progresión (P-42, D-60)", () => {
    const props = {
      ejercicioNombre: "Press de Banca",
      marcaActual: 40,
      deltaEsteMes: 0,
      progresionCarga: [
        { fecha: "2026-09-26", carga: 40 },
        { fecha: "2026-10-03", carga: 40 },
      ],
    };

    it("subir: muestra la carga y el incremento, y el motivo", () => {
      render(<ProgresoSection {...props} sugerencia={{ ...subir, carga: 42.5 }} />);

      expect(screen.getByTestId("sugerencia")).toHaveAttribute("data-tipo", "subir");
      expect(screen.getByText("42,5 kg")).toBeInTheDocument();
      expect(screen.getByText("(+2,5 kg)")).toBeInTheDocument();
      expect(screen.getByTestId("sugerencia-motivo")).toHaveTextContent(/hiciste todas las repeticiones/i);
    });

    it("mantener: dice 'Mantené 40 kg' sin incremento ni flecha, con el motivo", () => {
      render(
        <ProgresoSection
          {...props}
          sugerencia={{
            tipo: "mantener",
            carga: 40,
            motivo: "No llegaste a todas las repeticiones la última vez: mismo peso otra vez.",
          }}
        />
      );

      expect(screen.getByTestId("sugerencia")).toHaveAttribute("data-tipo", "mantener");
      expect(screen.getByText("Mantené 40 kg")).toBeInTheDocument();
      expect(screen.queryByText(/\(\+/)).not.toBeInTheDocument();
      expect(screen.getByTestId("sugerencia-motivo")).toHaveTextContent(/mismo peso otra vez/i);
    });

    it("descargar: dice 'Bajá a 36 kg' y explica por qué", () => {
      render(
        <ProgresoSection
          {...props}
          sugerencia={{
            tipo: "descargar",
            carga: 36,
            motivo: "3 sesiones seguidas sin llegar a las repeticiones: bajá a 36 kg y volvé a subir.",
          }}
        />
      );

      expect(screen.getByTestId("sugerencia")).toHaveAttribute("data-tipo", "descargar");
      expect(screen.getByText("Bajá a 36 kg")).toBeInTheDocument();
      expect(screen.getByTestId("sugerencia-motivo")).toHaveTextContent(/3 sesiones seguidas/i);
    });

    it("sin sugerencia (null) no muestra la fila", () => {
      render(<ProgresoSection {...props} sugerencia={null} />);

      expect(screen.queryByTestId("sugerencia")).not.toBeInTheDocument();
      expect(screen.queryByText(/próxima sesión sugerida/i)).not.toBeInTheDocument();
    });

    it("sin carga para sugerir (peso corporal) o primera vez: no inventa un número", () => {
      const { rerender } = render(
        <ProgresoSection
          {...props}
          sugerencia={{ tipo: "mantener", carga: null, motivo: "No hay una carga registrada." }}
        />
      );
      expect(screen.queryByTestId("sugerencia")).not.toBeInTheDocument();

      rerender(
        <ProgresoSection
          {...props}
          sugerencia={{ tipo: "primera", carga: null, motivo: "Primera vez con este ejercicio." }}
        />
      );
      expect(screen.queryByTestId("sugerencia")).not.toBeInTheDocument();
    });
  });

  it("shows an empty state and hides the chart/footer when there is no history", () => {
    render(
      <ProgresoSection
        ejercicioNombre="Press de Banca"
        marcaActual={0}
        deltaEsteMes={0}
        progresionCarga={[]}
        sugerencia={null}
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
        sugerencia={subir}
        onVerTodosLosEjercicios={onVer}
      />
    );
    await user.click(screen.getByText(/ver todos los ejercicios/i));
    expect(onVer).toHaveBeenCalledTimes(1);
  });
});
