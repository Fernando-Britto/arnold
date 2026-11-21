/**
 * Historial local de series del ejercicio actual: valores reales de la sesión, pendientes con la
 * repetición prescripta, series sin datos tras una recarga y calentamientos al final.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { HistorialSeries, type SerieLocal } from "./historial-series";

const local = (over: Partial<SerieLocal> = {}): SerieLocal => ({
  numeroSerie: 1,
  carga: 40,
  repeticiones: 10,
  rir: 2,
  tipo: "NORMAL",
  drops: 0,
  ...over,
});

function filasDeDatos() {
  return within(screen.getByTestId("historial-series")).getAllByRole("row").slice(1);
}

describe("HistorialSeries", () => {
  it("muestra las pendientes con la repetición planificada y el resto en guiones", () => {
    render(
      <HistorialSeries planificadas={3} repeticionesPlanificadas={8} serieActual={1} historial={[]} />
    );

    const filas = filasDeDatos().map((fila) => fila.textContent);
    expect(filas).toHaveLength(3);
    expect(filas[0]).toContain("8");
    expect(filas[0]).toContain("—");
  });

  it("una serie registrada muestra sus valores reales", () => {
    render(
      <HistorialSeries
        planificadas={2}
        repeticionesPlanificadas={10}
        serieActual={2}
        historial={[local()]}
      />
    );

    const primera = filasDeDatos()[0];
    expect(primera).toHaveTextContent("1");
    expect(primera).toHaveTextContent("10");
    expect(primera).toHaveTextContent("40 kg");
    expect(primera).toHaveTextContent("2");
    expect(primera).toHaveTextContent("Normal");
  });

  it("las series anteriores a una recarga quedan como realizadas sin valores y avisa", () => {
    render(
      <HistorialSeries
        planificadas={3}
        repeticionesPlanificadas={10}
        serieActual={3}
        historial={[]}
      />
    );

    expect(screen.getByText(/las series anteriores a la recarga no tienen valores disponibles/i)).toBeInTheDocument();
    const primeras = filasDeDatos().slice(0, 2).map((fila) => fila.textContent);
    expect(primeras[0]).toContain("—");
    expect(primeras[1]).toContain("—");
  });

  it("los calentamientos van al final con la serie en guion", () => {
    render(
      <HistorialSeries
        planificadas={1}
        repeticionesPlanificadas={10}
        serieActual={2}
        historial={[local(), local({ numeroSerie: null, tipo: "CALENTAMIENTO", carga: 20, repeticiones: 12, rir: null })]}
      />
    );

    const filas = filasDeDatos().map((fila) => fila.textContent);
    expect(filas).toHaveLength(2);
    expect(filas[1]).toContain("—");
    expect(filas[1]).toContain("Calentamiento");
    expect(filas[1]).toContain("20 kg");
  });

  it("indica cuántos drop sets colgaron de la serie", () => {
    render(
      <HistorialSeries
        planificadas={1}
        repeticionesPlanificadas={10}
        serieActual={2}
        historial={[local({ drops: 2 })]}
      />
    );

    expect(filasDeDatos()[0]).toHaveTextContent("Normal · 2 drops");
  });
});
