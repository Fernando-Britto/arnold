import React from "react";
import { render, screen } from "@testing-library/react";
import { AforoCard, type HoraOcupacion } from "./aforo-card";

const horas: HoraOcupacion[] = [
  { hora: 6, ocupacion: 5 },
  { hora: 8, ocupacion: 10 },
  { hora: 10, ocupacion: 15 },
  { hora: 12, ocupacion: 20 },
  { hora: 22, ocupacion: 30 },
];

describe("AforoCard (spec: home-socio-portal §AforoCard, matches Home_Socio_1x.png)", () => {
  it('shows the live occupancy as "actual / capacidadMaxima"', () => {
    render(
      <AforoCard
        ocupacionActual={47}
        capacidadMaxima={80}
        horas={horas}
        horaActual={22}
      />
    );
    expect(screen.getByText("47 / 80")).toBeInTheDocument();
  });

  it('shows the "based on last 90 minutes" caption', () => {
    render(
      <AforoCard
        ocupacionActual={47}
        capacidadMaxima={80}
        horas={horas}
        horaActual={22}
      />
    );
    expect(
      screen.getByText(/basado en ingresos de los últimos 90 min/i)
    ).toBeInTheDocument();
  });

  it("renders one bar per hour bucket", () => {
    render(
      <AforoCard
        ocupacionActual={47}
        capacidadMaxima={80}
        horas={horas}
        horaActual={22}
      />
    );
    expect(screen.getAllByTestId("aforo-bar")).toHaveLength(5);
  });

  it("highlights only the current hour's bar", () => {
    render(
      <AforoCard
        ocupacionActual={47}
        capacidadMaxima={80}
        horas={horas}
        horaActual={22}
      />
    );
    const bars = screen.getAllByTestId("aforo-bar");
    const current = bars.filter((b) => b.getAttribute("data-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("data-hora", "22");
  });

  it("shows a configuration warning instead of dividing by zero when capacidadMaxima is 0", () => {
    render(
      <AforoCard ocupacionActual={0} capacidadMaxima={0} horas={[]} horaActual={12} />
    );
    expect(screen.getByText(/aforo no configurado/i)).toBeInTheDocument();
  });
});
