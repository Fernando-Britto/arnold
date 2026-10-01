import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertasCard } from "./alertas-card";

const items = [
  { socioId: "s1", texto: "Vencimiento · Marta G.", detalle: "Venció hace 2 días" },
  { socioId: "s2", texto: "Vencimiento · Juan P.", detalle: "Vence en 5 h" },
];

describe("AlertasCard (Row_Hoy · Alertas)", () => {
  it("renders each alert with its text and timestamp detail", () => {
    render(<AlertasCard items={items} onVer={jest.fn()} />);
    expect(screen.getByText("Alertas críticas")).toBeInTheDocument();
    expect(screen.getByText("Vencimiento · Marta G.")).toBeInTheDocument();
    expect(screen.getByText("Venció hace 2 días")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /ver/i })).toHaveLength(2);
  });

  it("calls onVer with the socio id", async () => {
    const onVer = jest.fn();
    render(<AlertasCard items={items} onVer={onVer} />);
    await userEvent.setup().click(screen.getAllByRole("button", { name: /ver/i })[1]);
    expect(onVer).toHaveBeenCalledWith("s2");
  });

  it("shows an empty-state message instead of a blank area (spec edge case: zero alerts)", () => {
    render(<AlertasCard items={[]} onVer={jest.fn()} />);
    expect(screen.getByText("Sin alertas por ahora.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
