import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClienteList } from "./cliente-list";

const clientes = [
  {
    id: "cliente-1",
    nombre: "Ana García",
    dni: "30123456",
    email: "ana@example.com",
    telefono: "+54 9 1234 567890",
    membresiaAsignada: "gold-1",
    estadoCuenta: "Activo" as const,
    fechaAlta: new Date("2024-01-15"),
  },
  {
    id: "cliente-2",
    nombre: "Bruno Díaz",
    dni: "28987654",
    email: "bruno@example.com",
    telefono: null,
    membresiaAsignada: "silver-1",
    estadoCuenta: "Bloqueado" as const,
    fechaAlta: new Date("2024-02-20"),
  },
];

describe("ClienteList", () => {
  it("renderiza las columnas exactas del mockup", () => {
    render(<ClienteList clientes={clientes} />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("DNI")).toBeInTheDocument();
    expect(screen.getByText("Membresía")).toBeInTheDocument();
    expect(screen.getByText("Estado de cuota")).toBeInTheDocument();
  });

  it("muestra el estado de cuota como badge", () => {
    render(<ClienteList clientes={clientes} />);
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
  });

  it("resuelve el label de membresía", () => {
    render(
      <ClienteList clientes={clientes} membresiaLabels={{ "gold-1": "Gold - $150.00" }} />,
    );
    expect(screen.getByText("Gold - $150.00")).toBeInTheDocument();
  });

  it("no renderiza botones por fila", () => {
    render(<ClienteList clientes={clientes} />);
    expect(screen.queryByRole("button", { name: /Editar|Eliminar/i })).not.toBeInTheDocument();
  });

  it("selecciona una fila al hacer click", async () => {
    const onSelect = jest.fn();
    render(<ClienteList clientes={clientes} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Ana García"));
    expect(onSelect).toHaveBeenCalledWith(clientes[0]);
  });

  it("marca la fila seleccionada y muestra el detalle", () => {
    render(<ClienteList clientes={clientes} selectedId="cliente-1" />);
    const selected = screen
      .getAllByRole("row")
      .find((r) => r.getAttribute("aria-selected") === "true");
    expect(selected).toHaveClass("bg-[#FC4C02]");
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("filtra por nombre, DNI o email", () => {
    render(<ClienteList clientes={clientes} searchTerm="bruno@example.com" />);
    expect(screen.getByText("Bruno Díaz")).toBeInTheDocument();
    expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío", () => {
    render(<ClienteList clientes={[]} />);
    expect(screen.getByText(/No hay clientes registrados/i)).toBeInTheDocument();
  });
});
