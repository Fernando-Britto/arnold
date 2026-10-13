import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiaListPanel } from "./membresia-list-panel";
import type { Membresia } from "@/domains/membresia/membresia";

const membresias: Membresia[] = [
  {
    id: "11111111gold",
    nombre: "Gold",
    precio: 15000,
    periodicidad: 30,
    descripcion: "Premium",
    estado: "ACTIVA",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "22222222silver",
    nombre: "Silver",
    precio: 10000,
    periodicidad: 30,
    descripcion: null,
    estado: "INACTIVA",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("MembresiaListPanel", () => {
  it("renderiza las columnas exactas del mockup", () => {
    render(<MembresiaListPanel membresias={membresias} />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Precio")).toBeInTheDocument();
    expect(screen.getByText("Periodicidad")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
  });

  it("muestra precio, periodicidad y estado como badge", () => {
    render(<MembresiaListPanel membresias={membresias} />);
    expect(screen.getByText("$15000.00")).toBeInTheDocument();
    expect(screen.getAllByText("30 días")).toHaveLength(2);
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("Inactiva")).toBeInTheDocument();
  });

  it("selecciona una fila al hacer click", async () => {
    const onSelect = jest.fn();
    render(<MembresiaListPanel membresias={membresias} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Gold"));
    expect(onSelect).toHaveBeenCalledWith(membresias[0]);
  });

  it("marca la fila seleccionada y muestra su detalle", () => {
    render(<MembresiaListPanel membresias={membresias} selectedId="11111111gold" />);
    const selected = screen
      .getAllByRole("row")
      .find((r) => r.getAttribute("aria-selected") === "true");
    expect(selected).toHaveClass("bg-[#FC4C02]");
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("filtra por nombre", () => {
    render(<MembresiaListPanel membresias={membresias} searchTerm="sil" />);
    expect(screen.getByText("Silver")).toBeInTheDocument();
    expect(screen.queryByText("Gold")).not.toBeInTheDocument();
  });

  it("muestra el estado de carga", () => {
    render(<MembresiaListPanel membresias={[]} isLoading />);
    expect(screen.getByText(/Cargando membresías/i)).toBeInTheDocument();
  });

  it("muestra el estado vacío", () => {
    render(<MembresiaListPanel membresias={[]} />);
    expect(screen.getByText(/No hay membresías/i)).toBeInTheDocument();
  });
});
