import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickActions } from "./quick-actions";

describe("QuickActions (AC-001: exactly 4 buttons, literal labels, no zone title)", () => {
  it("renders exactly the 4 literal labels in order", () => {
    render(<QuickActions onAction={jest.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Nuevo Socio",
      "Registrar Pago",
      "Asignar Rutina",
      "Control Acceso",
    ]);
  });

  it("renders no zone title", () => {
    render(<QuickActions onAction={jest.fn()} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("reports which action was clicked", async () => {
    const onAction = jest.fn();
    render(<QuickActions onAction={onAction} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Control Acceso" }));
    expect(onAction).toHaveBeenCalledWith("control-acceso");
  });
});
