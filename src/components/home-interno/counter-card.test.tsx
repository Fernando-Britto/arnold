import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CounterCard } from "./counter-card";

describe("CounterCard (Row_Gestion: label + live count, clickable)", () => {
  it("renders the label and the metric", () => {
    render(<CounterCard label="Rutinas" metric="124" onClick={jest.fn()} />);
    expect(screen.getByText("Rutinas")).toBeInTheDocument();
    expect(screen.getByText("124")).toBeInTheDocument();
  });

  it("calls onClick when pressed", async () => {
    const onClick = jest.fn();
    render(<CounterCard label="Clientes" metric="892" onClick={onClick} />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not navigate when the role has no access", async () => {
    const onClick = jest.fn();
    render(<CounterCard label="Membresías" metric="15" onClick={onClick} disabled />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Sin acceso con tu rol");
    await userEvent.setup().click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
