/**
 * Encabezado de la pantalla de entrenamiento (T-049, D-67): ejercicio actual, series hechas,
 * tiempo transcurrido y barra de progreso.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { EncabezadoDeSesion } from "./encabezado-de-sesion";

const base = { hechas: 7, total: 19, ejercicioNumero: 2, ejerciciosTotal: 6, transcurridoMs: 754_000 };

describe("EncabezadoDeSesion", () => {
  it("dice en qué ejercicio va, cuántas series hizo y cuánto lleva", () => {
    render(<EncabezadoDeSesion {...base} />);

    expect(screen.getByTestId("sesion-ejercicio")).toHaveTextContent("Ejercicio 2 de 6");
    expect(screen.getByTestId("sesion-series")).toHaveTextContent("7/19 series");
    expect(screen.getByTestId("sesion-tiempo")).toHaveTextContent("12:34");
  });

  it("la barra es una barra de progreso accesible, con el texto en palabras", () => {
    render(<EncabezadoDeSesion {...base} />);

    const barra = screen.getByRole("progressbar", { name: /progreso de la sesión/i });
    expect(barra).toHaveAttribute("aria-valuemin", "0");
    expect(barra).toHaveAttribute("aria-valuemax", "19");
    expect(barra).toHaveAttribute("aria-valuenow", "7");
    expect(barra).toHaveAttribute("aria-valuetext", "7 de 19 series");
  });

  it("el relleno de la barra es proporcional a las series hechas", () => {
    render(<EncabezadoDeSesion {...base} hechas={5} total={10} />);

    expect(screen.getByTestId("sesion-relleno")).toHaveStyle({ width: "50%" });
  });

  it("al empezar la barra está vacía", () => {
    render(<EncabezadoDeSesion {...base} hechas={0} />);

    expect(screen.getByTestId("sesion-relleno")).toHaveStyle({ width: "0%" });
  });

  it("el reloj no se anuncia cada segundo a los lectores de pantalla", () => {
    const { container } = render(<EncabezadoDeSesion {...base} />);

    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(container.querySelector("[role='timer']")).toBeNull();
  });

  it("sin número de ejercicio (no se pudo ubicar) no inventa 'Ejercicio null de 6'", () => {
    render(<EncabezadoDeSesion {...base} ejercicioNumero={null} />);

    expect(screen.queryByTestId("sesion-ejercicio")).not.toBeInTheDocument();
    expect(screen.getByTestId("sesion-series")).toHaveTextContent("7/19 series");
  });

  it("una rutina sin series no divide por cero", () => {
    render(<EncabezadoDeSesion {...base} hechas={0} total={0} ejerciciosTotal={0} ejercicioNumero={null} />);

    expect(screen.getByTestId("sesion-relleno")).toHaveStyle({ width: "0%" });
    expect(screen.getByTestId("sesion-series")).toHaveTextContent("0/0 series");
  });
});
