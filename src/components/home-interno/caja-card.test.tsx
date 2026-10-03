import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CajaCard } from "./caja-card";

describe("CajaCard (AC-004: Efectivo / Transferencia / Total)", () => {
  it("matches the spec's data scenario: $150.00 / $200.00 / $350.00", () => {
    render(<CajaCard efectivo={150} transferencia={200} tarjeta={0} total={350} onCierreDeCaja={jest.fn()} />);
    expect(screen.getByText("$150.00")).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    expect(screen.getByTestId("caja-total")).toHaveTextContent("$350.00");
  });

  it("shows the Tarjeta line so the three parts add up to the total", () => {
    render(<CajaCard efectivo={50} transferencia={0} tarjeta={30} total={80} onCierreDeCaja={jest.fn()} />);
    expect(screen.getByText("Tarjeta")).toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.getByTestId("caja-total")).toHaveTextContent("$80.00");
  });

  it("renders zeros when there are no payments today", () => {
    render(<CajaCard efectivo={0} transferencia={0} tarjeta={0} total={0} onCierreDeCaja={jest.fn()} />);
    expect(screen.getByTestId("caja-total")).toHaveTextContent("$0.00");
  });

  it("exposes the Cierre de Caja button", async () => {
    const onCierre = jest.fn();
    render(<CajaCard efectivo={0} transferencia={0} tarjeta={0} total={0} onCierreDeCaja={onCierre} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Cierre de Caja" }));
    expect(onCierre).toHaveBeenCalledTimes(1);
  });
});
