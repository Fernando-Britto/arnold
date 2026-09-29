import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renderiza el texto recibido", () => {
    render(<Badge variant="success">Activo</Badge>);
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it.each([
    ["success", "bg-green-100", "text-green-800"],
    ["danger", "bg-red-100", "text-red-700"],
    ["warning", "bg-amber-100", "text-amber-800"],
    ["info", "bg-blue-100", "text-blue-700"],
    ["neutral", "bg-zinc-100", "text-gray-500"],
  ] as const)("variante %s aplica %s y %s", (variant, bg, text) => {
    render(<Badge variant={variant}>Etiqueta</Badge>);
    const el = screen.getByText("Etiqueta");
    expect(el).toHaveClass(bg);
    expect(el).toHaveClass(text);
  });

  it("usa neutral por defecto", () => {
    render(<Badge>Sin variante</Badge>);
    expect(screen.getByText("Sin variante")).toHaveClass("bg-zinc-100");
  });
});
