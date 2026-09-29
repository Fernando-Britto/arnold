import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search } from "lucide-react";
import { ActionBar, ActionButton } from "./action-bar";

describe("ActionBar", () => {
  it("muestra el breadcrumb Gestión > sección", () => {
    render(<ActionBar breadcrumb="Ejercicios" />);
    expect(screen.getByText("Gestión")).toBeInTheDocument();
    expect(screen.getByText("Ejercicios")).toHaveAttribute("aria-current", "page");
  });

  it("renderiza los botones recibidos como children", () => {
    render(
      <ActionBar breadcrumb="Rutinas">
        <ActionButton icon={Search} label="Buscar" onClick={() => {}} />
      </ActionBar>
    );
    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
  });
});

describe("ActionButton", () => {
  it("dispara onClick", async () => {
    const onClick = jest.fn();
    render(<ActionButton icon={Search} label="Buscar" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled no dispara onClick y queda semitransparente", async () => {
    const onClick = jest.fn();
    render(<ActionButton icon={Search} label="Asignar" onClick={onClick} disabled />);
    const btn = screen.getByRole("button", { name: "Asignar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass("opacity-50");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("variante accent usa el color de marca en el texto", () => {
    render(<ActionButton icon={Search} label="Modificar" onClick={() => {}} variant="accent" />);
    expect(screen.getByRole("button", { name: "Modificar" })).toHaveClass("text-[#FC4C02]");
  });
});
