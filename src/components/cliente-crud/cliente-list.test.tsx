import React from "react";
import { render, screen, within } from "@testing-library/react";
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
    estadoCuenta: "Activa" as const,
    fechaAlta: new Date("2024-01-15"),
  },
  {
    id: "cliente-2",
    nombre: "Bruno Díaz",
    dni: "28987654",
    email: "bruno@example.com",
    telefono: null,
    membresiaAsignada: "silver-1",
    estadoCuenta: "Bloqueada" as const,
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
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("Bloqueada")).toBeInTheDocument();
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
    expect(selected).toHaveClass("bg-[#FDEDE4]");
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("cada fila lleva el chevron que anuncia que se despliega", () => {
    render(<ClienteList clientes={clientes} selectedId="cliente-1" />);

    const chevrons = document.querySelectorAll("[data-disclosure-indicator]");
    // Uno por fila: la lista está cableada con `disclosure`.
    expect(chevrons).toHaveLength(clientes.length);
    // La abierta apunta hacia arriba y en naranja; las cerradas hacia abajo y en gris.
    const abierto = screen
      .getAllByRole("row")
      .find((r) => r.getAttribute("aria-selected") === "true")
      ?.querySelector("[data-disclosure-indicator]");
    expect(abierto).toHaveClass("rotate-180", "text-[#FC4C02]");
    const cerrado = screen
      .getAllByRole("row")
      .find((r) => r.getAttribute("aria-selected") === "false")
      ?.querySelector("[data-disclosure-indicator]");
    expect(cerrado).toHaveClass("text-[#A1A1AA]");
  });

  it("filtra por nombre, DNI o email", () => {
    render(<ClienteList clientes={clientes} searchTerm="bruno@example.com" />);
    expect(screen.getByText("Bruno Díaz")).toBeInTheDocument();
    expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
  });

  it("encuentra por DNI con puntos (normaliza el término de búsqueda)", () => {
    render(<ClienteList clientes={clientes} searchTerm="30.123.456" />);
    expect(screen.getByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByText("Bruno Díaz")).not.toBeInTheDocument();
  });

  it("sigue encontrando por DNI sin puntos", () => {
    render(<ClienteList clientes={clientes} searchTerm="30123456" />);
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("muestra el estado vacío", () => {
    render(<ClienteList clientes={[]} />);
    expect(screen.getByText(/No hay clientes registrados/i)).toBeInTheDocument();
  });

  describe("orden por columna (spec: Nombre, DNI, Email, Membresía, Estado)", () => {
    const nombres = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[1]?.textContent);

    it("ordena por DNI asc y luego desc al hacer click en el encabezado", async () => {
      render(<ClienteList clientes={clientes} />);
      // Orden por defecto: nombre asc.
      expect(nombres()).toEqual(["Ana García", "Bruno Díaz"]);

      const dniHeader = screen.getByRole("columnheader", { name: "DNI" });

      await userEvent.click(within(dniHeader).getByRole("button"));
      expect(nombres()).toEqual(["Bruno Díaz", "Ana García"]);
      expect(dniHeader).toHaveAttribute("aria-sort", "ascending");
      expect(within(dniHeader).getByText("▲")).toBeInTheDocument();

      await userEvent.click(within(dniHeader).getByRole("button"));
      expect(nombres()).toEqual(["Ana García", "Bruno Díaz"]);
      expect(dniHeader).toHaveAttribute("aria-sort", "descending");
      expect(within(dniHeader).getByText("▼")).toBeInTheDocument();
    });

    it("ordena por estado de cuota respetando mayúsculas/acentos", async () => {
      render(<ClienteList clientes={clientes} />);
      const estadoHeader = screen.getByRole("columnheader", { name: "Estado de cuota" });

      await userEvent.click(within(estadoHeader).getByRole("button"));
      expect(nombres()).toEqual(["Ana García", "Bruno Díaz"]);

      await userEvent.click(within(estadoHeader).getByRole("button"));
      expect(nombres()).toEqual(["Bruno Díaz", "Ana García"]);
    });
  });
});
