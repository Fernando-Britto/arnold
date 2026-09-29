import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RachaSemanal } from "./racha-semanal";
import type { DiaCalendario } from "@/domains/home-socio/home-socio";

const dias: DiaCalendario[] = [
  { numero: 21, asistio: true, esHoy: false },
  { numero: 22, asistio: true, esHoy: false },
  { numero: 23, asistio: false, esHoy: false },
  { numero: 24, asistio: true, esHoy: false },
  { numero: 25, asistio: false, esHoy: true },
  { numero: 26, asistio: false, esHoy: false },
  { numero: 27, asistio: false, esHoy: false },
];

describe("RachaSemanal (matches Home_Socio_1x §Fila3 RachaSemanal)", () => {
  it("shows the streak count in weeks", () => {
    render(<RachaSemanal semanasRacha={3} dias={dias} />);
    expect(screen.getByTestId("racha-count")).toHaveTextContent("3");
    expect(screen.getByText("Semanas")).toBeInTheDocument();
  });

  it('uses the singular "Semana" for a streak of 1', () => {
    render(<RachaSemanal semanasRacha={1} dias={dias} />);
    expect(screen.getByText("Semana")).toBeInTheDocument();
  });

  it("renders the 7 weekday letters Mon–Sun", () => {
    render(<RachaSemanal semanasRacha={3} dias={dias} />);
    ["L", "M", "X", "J", "V", "S", "D"].forEach((l) =>
      expect(screen.getByText(l)).toBeInTheDocument()
    );
  });

  it("marks attended days with an icon (no number), and shows the day number otherwise", () => {
    render(<RachaSemanal semanasRacha={3} dias={dias} />);
    const cells = screen.getAllByTestId("dia-celda");
    expect(cells).toHaveLength(7);
    expect(cells.map((c) => c.getAttribute("data-estado"))).toEqual([
      "asistio",
      "asistio",
      "libre",
      "asistio",
      "hoy",
      "libre",
      "libre",
    ]);
    expect(screen.queryByText("21")).not.toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("shows an attended today as attended, not as the empty-today ring", () => {
    const conHoyAsistido = dias.map((d) => (d.esHoy ? { ...d, asistio: true } : d));
    render(<RachaSemanal semanasRacha={3} dias={conHoyAsistido} />);
    expect(screen.getAllByTestId("dia-celda")[4]).toHaveAttribute("data-estado", "asistio");
  });

  it("calls onVerHistorial when the history link is clicked", async () => {
    const onVerHistorial = jest.fn();
    const user = userEvent.setup();
    render(<RachaSemanal semanasRacha={3} dias={dias} onVerHistorial={onVerHistorial} />);
    await user.click(screen.getByText(/ver mi historial completo/i));
    expect(onVerHistorial).toHaveBeenCalledTimes(1);
  });
});
