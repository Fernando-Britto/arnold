/**
 * Gráfico de línea del peso corporal (T-048 parte 2, D-66): SVG propio, sin librería.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { GraficoDePeso } from "./grafico-de-peso";

const punto = (iso: string, peso: number) => ({ fecha: new Date(iso), peso });
const puntos = [
  punto("2026-09-01T15:00:00.000Z", 82),
  punto("2026-09-15T15:00:00.000Z", 80),
  punto("2026-10-01T15:00:00.000Z", 78.4),
];

describe("GraficoDePeso", () => {
  it("es una imagen con una descripción en palabras de cómo evolucionó el peso", () => {
    render(<GraficoDePeso puntos={puntos} meta={null} />);

    expect(
      screen.getByRole("img", { name: "Evolución del peso: de 82 kg el 1 sep a 78,4 kg el 1 oct" })
    ).toBeInTheDocument();
  });

  it("dibuja la línea y un círculo por pesaje", () => {
    const { container } = render(<GraficoDePeso puntos={puntos} meta={null} />);

    expect(container.querySelector("path[data-testid='linea-de-peso']")?.getAttribute("d")).toMatch(/^M/);
    expect(container.querySelectorAll("circle[data-testid='punto-de-peso']")).toHaveLength(3);
  });

  it("la meta es una línea punteada con su rótulo escrito (no depende solo del trazo)", () => {
    const { container } = render(<GraficoDePeso puntos={puntos} meta={77} />);

    const meta = container.querySelector("line[data-testid='linea-de-meta']");
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(screen.getByText("Meta 77 kg")).toBeInTheDocument();
  });

  it("sin meta no dibuja la línea de la meta", () => {
    const { container } = render(<GraficoDePeso puntos={puntos} meta={null} />);

    expect(container.querySelector("line[data-testid='linea-de-meta']")).toBeNull();
    expect(screen.queryByText(/^Meta/)).not.toBeInTheDocument();
  });

  it("rotula el eje de pesos y el primer y último día", () => {
    render(<GraficoDePeso puntos={puntos} meta={null} />);

    expect(screen.getByText("1 sep")).toBeInTheDocument();
    expect(screen.getByText("1 oct")).toBeInTheDocument();
    expect(screen.getAllByTestId("marca-de-peso").length).toBeGreaterThanOrEqual(2);
  });

  it("con un solo pesaje dibuja el punto, sin línea", () => {
    const { container } = render(
      <GraficoDePeso puntos={[punto("2026-10-01T15:00:00.000Z", 78.4)]} meta={77} />
    );

    expect(container.querySelectorAll("circle[data-testid='punto-de-peso']")).toHaveLength(1);
    expect(container.querySelector("path[data-testid='linea-de-peso']")).toBeNull();
    expect(screen.getByRole("img", { name: "Peso: 78,4 kg el 1 oct" })).toBeInTheDocument();
  });

  it("sin pesajes no dibuja nada", () => {
    const { container } = render(<GraficoDePeso puntos={[]} meta={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
