import React from "react";
import { render, screen } from "@testing-library/react";
import { ActivityColumn, formatHaceTiempo, type ActivityItemView } from "./activity-column";

describe("formatHaceTiempo", () => {
  const hoy = new Date("2026-09-30T18:00:00Z");

  it('formats minutes as "Hace N min"', () => {
    expect(formatHaceTiempo(new Date("2026-09-30T17:58:00Z"), hoy)).toBe("Hace 2 min");
  });

  it('formats a single hour as "Hace 1 hora" (singular)', () => {
    expect(formatHaceTiempo(new Date("2026-09-30T17:00:00Z"), hoy)).toBe("Hace 1 hora");
  });

  it('formats multiple hours as "Hace N horas" (plural)', () => {
    expect(formatHaceTiempo(new Date("2026-09-30T16:00:00Z"), hoy)).toBe("Hace 2 horas");
  });

  it('formats under a minute as "Hace unos segundos"', () => {
    expect(formatHaceTiempo(new Date("2026-09-30T17:59:50Z"), hoy)).toBe("Hace unos segundos");
  });
});

describe("ActivityColumn (spec: matches Home_Interno §Col_Actividad, AC-007)", () => {
  const items: ActivityItemView[] = [
    { nombre: "Ana López", descripcion: "Pago de membresía Pro", haceTexto: "Hace 15 min" },
    { nombre: "Carlos Mendez", descripcion: "Alta de nuevo socio", haceTexto: "Hace 2 horas" },
  ];

  it('renders the zone title "Últimos movimientos"', () => {
    render(<ActivityColumn items={items} />);
    expect(screen.getByText("Últimos movimientos")).toBeInTheDocument();
  });

  it('renders each item as "Nombre · Descripción" with the relative time on the right', () => {
    render(<ActivityColumn items={items} />);
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText("Pago de membresía Pro")).toBeInTheDocument();
    expect(screen.getByText("Hace 15 min")).toBeInTheDocument();
  });

  it("shows an explicit empty state instead of a blank list (AC-007, edge case)", () => {
    render(<ActivityColumn items={[]} />);
    expect(screen.getByText(/sin movimientos/i)).toBeInTheDocument();
  });
});
