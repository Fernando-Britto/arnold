/**
 * "Última vez" (D-58): series de la sesión anterior, con la serie en curso resaltada.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { UltimaVez } from "./ultima-vez";

const AHORA = new Date("2026-10-16T15:00:00.000Z").getTime();

const ultimaVez = {
  fecha: "2026-10-10T13:05:00.000Z",
  series: [
    { carga: 40, repeticiones: 10, rir: 3 },
    { carga: 42.5, repeticiones: 8, rir: 1 },
  ],
};

describe("UltimaVez", () => {
  it("muestra cuándo fue y cada serie con carga, repeticiones y RIR", () => {
    render(<UltimaVez ultimaVez={ultimaVez} serieActual={1} ahora={AHORA} />);

    expect(screen.getByText(/última vez · hace 6 días/i)).toBeInTheDocument();
    const series = screen.getAllByTestId("ultima-vez-serie");
    expect(series.map((s) => s.textContent)).toEqual([
      "40 kg × 10 · RIR 3",
      "42,5 kg × 8 · RIR 1",
    ]);
  });

  it("resalta la serie equivalente a la que se está por hacer", () => {
    render(<UltimaVez ultimaVez={ultimaVez} serieActual={2} ahora={AHORA} />);

    const series = screen.getAllByTestId("ultima-vez-serie");
    expect(series[0]).not.toHaveAttribute("aria-current");
    expect(series[1]).toHaveAttribute("aria-current", "true");
  });

  it("sin historial dice que es la primera vez", () => {
    render(<UltimaVez ultimaVez={null} serieActual={1} ahora={AHORA} />);

    expect(screen.getByText(/primera vez con este ejercicio/i)).toBeInTheDocument();
    expect(screen.queryByTestId("ultima-vez-serie")).not.toBeInTheDocument();
  });

  it("una última vez sin series también se lee como primera vez", () => {
    render(
      <UltimaVez ultimaVez={{ fecha: ultimaVez.fecha, series: [] }} serieActual={1} ahora={AHORA} />
    );

    expect(screen.getByText(/primera vez con este ejercicio/i)).toBeInTheDocument();
  });

  describe("sugerencia de progresión (D-59)", () => {
    const subir = {
      tipo: "subir" as const,
      carga: 42.5,
      motivo: "Hiciste todas las repeticiones la última vez: +2,5 kg.",
    };

    it("muestra la carga sugerida y el motivo", () => {
      render(<UltimaVez ultimaVez={ultimaVez} serieActual={1} ahora={AHORA} sugerencia={subir} />);

      const linea = screen.getByTestId("sugerencia-progresion");
      expect(linea).toHaveAttribute("data-tipo", "subir");
      expect(linea).toHaveTextContent("Probá 42,5 kg");
      expect(linea).toHaveTextContent("Hiciste todas las repeticiones la última vez: +2,5 kg.");
    });

    it("distingue una descarga de una subida", () => {
      const descargar = {
        tipo: "descargar" as const,
        carga: 35,
        motivo: "3 sesiones seguidas sin llegar a las repeticiones: bajá a 35 kg y volvé a subir.",
      };
      render(
        <UltimaVez ultimaVez={ultimaVez} serieActual={1} ahora={AHORA} sugerencia={descargar} />
      );

      const linea = screen.getByTestId("sugerencia-progresion");
      expect(linea).toHaveAttribute("data-tipo", "descargar");
      expect(linea).toHaveTextContent("Probá 35 kg");
    });

    it("al mantener también explica por qué", () => {
      const mantener = {
        tipo: "mantener" as const,
        carga: 40,
        motivo: "No llegaste a todas las repeticiones la última vez: mismo peso otra vez.",
      };
      render(
        <UltimaVez ultimaVez={ultimaVez} serieActual={1} ahora={AHORA} sugerencia={mantener} />
      );

      const linea = screen.getByTestId("sugerencia-progresion");
      expect(linea).toHaveAttribute("data-tipo", "mantener");
      expect(linea).toHaveTextContent("Probá 40 kg");
      expect(linea).toHaveTextContent("mismo peso otra vez");
    });

    it("sin carga sugerida muestra solo el motivo", () => {
      const sinCarga = { tipo: "mantener" as const, carga: null, motivo: "No hay una carga registrada." };
      render(
        <UltimaVez ultimaVez={ultimaVez} serieActual={1} ahora={AHORA} sugerencia={sinCarga} />
      );

      const linea = screen.getByTestId("sugerencia-progresion");
      expect(linea).toHaveTextContent("No hay una carga registrada.");
      expect(linea).not.toHaveTextContent("Probá");
    });

    it("sin sugerencia no muestra la línea", () => {
      render(<UltimaVez ultimaVez={ultimaVez} serieActual={1} ahora={AHORA} sugerencia={null} />);

      expect(screen.queryByTestId("sugerencia-progresion")).not.toBeInTheDocument();
    });

    it("en la primera vez no hay línea de sugerencia", () => {
      render(
        <UltimaVez
          ultimaVez={null}
          serieActual={1}
          ahora={AHORA}
          sugerencia={{ tipo: "primera", carga: null, motivo: "Primera vez." }}
        />
      );

      expect(screen.queryByTestId("sugerencia-progresion")).not.toBeInTheDocument();
    });
  });

  it("etiqueta las series que no fueron normales (drop set, al fallo)", () => {
    render(
      <UltimaVez
        ultimaVez={{
          fecha: ultimaVez.fecha,
          series: [
            { carga: 40, repeticiones: 8, rir: 1 },
            { carga: 40, repeticiones: 6, rir: 0, tipo: "HASTA_EL_FALLO" },
            { carga: 30, repeticiones: 12, rir: 0, tipo: "DROP_SET" },
          ],
        }}
        serieActual={1}
        ahora={AHORA}
      />
    );

    expect(screen.getAllByTestId("ultima-vez-serie").map((s) => s.textContent)).toEqual([
      "40 kg × 8 · RIR 1",
      "40 kg × 6 · RIR 0 · al fallo",
      "30 kg × 12 · RIR 0 · drop set",
    ]);
  });
});

