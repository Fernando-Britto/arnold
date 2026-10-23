import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renderiza el texto recibido", () => {
    render(<Badge variant="success">Activo</Badge>);
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it.each([
    ["success", "bg-success-soft", "text-success"],
    ["danger", "bg-danger-soft", "text-danger"],
    ["warning", "bg-warning-soft", "text-warning"],
    ["info", "bg-info-soft", "text-info"],
    ["neutral", "bg-surface-subtle", "text-ink-soft"],
  ] as const)("variante %s aplica %s y %s", (variant, bg, text) => {
    render(<Badge variant={variant}>Etiqueta</Badge>);
    const el = screen.getByText("Etiqueta");
    expect(el).toHaveClass(bg);
    expect(el).toHaveClass(text);
  });

  it("usa neutral por defecto", () => {
    render(<Badge>Sin variante</Badge>);
    expect(screen.getByText("Sin variante")).toHaveClass("bg-surface-subtle");
  });
});
