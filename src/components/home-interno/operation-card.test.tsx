import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dumbbell } from "lucide-react";
import { OperationCard } from "./operation-card";

describe("OperationCard (matches Home_Interno §Row_Operacion, reused for the 3 status cards)", () => {
  it("renders the label, metric and footer", () => {
    render(
      <OperationCard
        label="Estado de equipos"
        metric="98%"
        footer="2 en mantenimiento"
        icon={Dumbbell}
      />
    );
    expect(screen.getByText("Estado de equipos")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(screen.getByText("2 en mantenimiento")).toBeInTheDocument();
  });

  it("renders as a clickable button when onClick is provided (spec: each card navigates to a filtered detail view)", async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(
      <OperationCard
        label="Personal en turno"
        metric="6"
        footer="2 entrenadores, 4 staff"
        icon={Dumbbell}
        onClick={onClick}
      />
    );
    await user.click(screen.getByRole("button", { name: /personal en turno/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("handles the zero-staff edge case without crashing (spec: shows 0, not blank)", () => {
    render(
      <OperationCard
        label="Personal en turno"
        metric="0"
        footer="Sin personal registrado"
        icon={Dumbbell}
      />
    );
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Sin personal registrado")).toBeInTheDocument();
  });
});
