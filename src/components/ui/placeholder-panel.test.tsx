import React from "react";
import { render, screen } from "@testing-library/react";
import { PlaceholderPanel } from "./placeholder-panel";

describe("PlaceholderPanel", () => {
  it("muestra el texto 'Trabajando en esto'", () => {
    render(<PlaceholderPanel />);
    expect(screen.getByText("Trabajando en esto")).toBeInTheDocument();
  });

  it("muestra título y descripción opcionales", () => {
    render(<PlaceholderPanel title="Pagos" description="Todavía no hay datos" />);
    expect(screen.getByText("Pagos")).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay datos")).toBeInTheDocument();
    expect(screen.getByText("Trabajando en esto")).toBeInTheDocument();
  });
});
