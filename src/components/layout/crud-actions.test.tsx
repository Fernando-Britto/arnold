import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrudActions } from "./crud-actions";

describe("CrudActions", () => {
  const base = {
    hasSelection: false,
    onModify: jest.fn(),
    onDelete: jest.fn(),
    searchTerm: "",
    onSearchChange: jest.fn(),
    searchLabel: "Buscar ejercicios",
    searchPlaceholder: "Buscar...",
  };

  it("Modificar y Eliminar están deshabilitados sin selección", () => {
    render(<CrudActions {...base} />);
    expect(screen.getByRole("button", { name: "Modificar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
  });

  it("Modificar y Eliminar se habilitan con selección y disparan sus handlers", async () => {
    const onModify = jest.fn();
    const onDelete = jest.fn();
    render(<CrudActions {...base} hasSelection onModify={onModify} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Modificar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onModify).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("Buscar muestra el input (con foco) y busca por texto", async () => {
    const onSearchChange = jest.fn();
    render(<CrudActions {...base} onSearchChange={onSearchChange} />);

    expect(screen.queryByLabelText("Buscar ejercicios")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const input = screen.getByLabelText("Buscar ejercicios");
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();

    await userEvent.type(input, "press");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("Buscar de nuevo cierra el input y limpia el término", async () => {
    const onSearchChange = jest.fn();
    render(<CrudActions {...base} searchTerm="press" onSearchChange={onSearchChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByLabelText("Buscar ejercicios")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.queryByLabelText("Buscar ejercicios")).not.toBeInTheDocument();
    expect(onSearchChange).toHaveBeenCalledWith("");
  });
});
