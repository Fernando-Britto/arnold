/**
 * Línea de récord en vivo (T-046c, D-63): mientras se elige la carga de la serie, el récord de
 * repeticiones a superar con esa carga o más, o el aviso de que se supera la mejor marca.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { RecordEnVivo } from "./record-en-vivo";

const frontera = [
  { carga: 40, repeticiones: 12 },
  { carga: 50, repeticiones: 6 },
  { carga: 60, repeticiones: 1 },
];

describe("RecordEnVivo", () => {
  it("con la carga de un récord, muestra las repeticiones a superar", () => {
    render(<RecordEnVivo frontera={frontera} carga={40} />);

    const linea = screen.getByTestId("record-en-vivo");
    expect(linea).toHaveAttribute("data-tipo", "record");
    expect(linea).toHaveTextContent("Récord a 40 kg: 12 reps");
  });

  it("si el récord es con una carga más pesada, lo aclara", () => {
    render(<RecordEnVivo frontera={frontera} carga={45} />);

    expect(screen.getByTestId("record-en-vivo")).toHaveTextContent(
      "Récord con 45 kg o más: 6 reps a 50 kg"
    );
  });

  it("usa el singular con una repetición y coma decimal", () => {
    render(<RecordEnVivo frontera={[{ carga: 62.5, repeticiones: 1 }]} carga={60} />);

    expect(screen.getByTestId("record-en-vivo")).toHaveTextContent(
      "Récord con 60 kg o más: 1 rep a 62,5 kg"
    );
  });

  it("con una carga más pesada que todo lo levantado, avisa que supera la mejor marca", () => {
    render(<RecordEnVivo frontera={frontera} carga={62.5} />);

    const linea = screen.getByTestId("record-en-vivo");
    expect(linea).toHaveAttribute("data-tipo", "nueva-carga");
    expect(linea).toHaveTextContent("Con esta carga superás tu mejor marca (60 kg)");
  });

  it("sin historial no muestra nada", () => {
    const { container } = render(<RecordEnVivo frontera={[]} carga={40} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("sin una carga elegida no muestra nada", () => {
    const { container } = render(<RecordEnVivo frontera={frontera} carga={0} />);

    expect(container).toBeEmptyDOMElement();
  });
});
