import React from "react";
import { render, screen } from "@testing-library/react";
import { AforoHoyCard } from "./aforo-hoy-card";

const horas = [
  { hora: 16, ocupacion: 20 },
  { hora: 18, ocupacion: 87 },
];

describe("AforoHoyCard (AC-003: 'N / capacidad miembros' + percentage)", () => {
  it("matches the spec's data scenario: '87 / 100 miembros' at 87%", () => {
    render(<AforoHoyCard ocupacionActual={87} capacidadMaxima={100} porcentaje={87} horas={horas} horaActual={18} />);
    expect(screen.getByText("87 / 100 miembros")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
  });

  it("highlights only the current hour's bar", () => {
    render(<AforoHoyCard ocupacionActual={87} capacidadMaxima={100} porcentaje={87} horas={horas} horaActual={18} />);
    const bars = screen.getAllByTestId("aforo-bar");
    expect(bars.map((b) => b.getAttribute("data-current"))).toEqual(["false", "true"]);
  });

  it("shows the true count above capacity while the percentage stays capped", () => {
    render(<AforoHoyCard ocupacionActual={120} capacidadMaxima={100} porcentaje={100} horas={[]} horaActual={18} />);
    expect(screen.getByText("120 / 100 miembros")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows 'Aforo no configurado' without crashing when capacidad is 0", () => {
    render(<AforoHoyCard ocupacionActual={5} capacidadMaxima={0} porcentaje={0} horas={[]} horaActual={18} />);
    expect(screen.getByText("Aforo no configurado")).toBeInTheDocument();
  });
});
