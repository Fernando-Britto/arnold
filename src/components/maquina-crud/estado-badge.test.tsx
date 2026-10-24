import React from "react";
import { render, screen } from "@testing-library/react";
import { EstadoBadge } from "./estado-badge";

describe("EstadoBadge", () => {
  it("muestra DISPONIBLE como success", () => {
    render(<EstadoBadge estado="DISPONIBLE" />);
    const badge = screen.getByText("Disponible");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success-soft");
  });

  it("muestra OCUPADA como warning", () => {
    render(<EstadoBadge estado="OCUPADA" />);
    const badge = screen.getByText("Ocupada");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-warning-soft");
  });

  it("muestra FUERA_DE_SERVICIO como danger", () => {
    render(<EstadoBadge estado="FUERA_DE_SERVICIO" />);
    const badge = screen.getByText("Fuera de servicio");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-danger-soft");
  });

  it("muestra INACTIVA como neutral", () => {
    render(<EstadoBadge estado="INACTIVA" />);
    const badge = screen.getByText("Inactiva");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-surface-subtle");
  });
});
