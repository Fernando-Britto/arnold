import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClienteList } from "./cliente-list";

const mockClientes = [
  {
    id: "cliente-1",
    nombre: "Ana García",
    dni: "30.123.456",
    email: "ana@example.com",
    telefono: "+54 9 1234 567890",
    membresiaAsignada: "gold-1",
    estadoCuenta: "Activo" as const,
    fechaAlta: new Date("2024-01-15"),
  },
  {
    id: "cliente-2",
    nombre: "Carlos López",
    dni: "25.987.654",
    email: "carlos@example.com",
    telefono: null,
    membresiaAsignada: "silver-1",
    estadoCuenta: "Inactivo" as const,
    fechaAlta: new Date("2023-11-20"),
  },
  {
    id: "cliente-3",
    nombre: "Beatriz Martínez",
    dni: "35.456.789",
    email: "beatriz@example.com",
    telefono: "+54 9 5678 901234",
    membresiaAsignada: "gold-1",
    estadoCuenta: "Bloqueado" as const,
    fechaAlta: new Date("2023-06-10"),
  },
];

describe("ClienteList", () => {
  describe("Display and rendering", () => {
    it("should render table with clientes", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      expect(screen.getByText("Clientes")).toBeInTheDocument();
      mockClientes.forEach((cliente) => {
        expect(screen.getByText(cliente.nombre)).toBeInTheDocument();
        expect(screen.getByText(cliente.dni)).toBeInTheDocument();
        expect(screen.getByText(cliente.email)).toBeInTheDocument();
      });
    });

    it("should show empty state when no clientes", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      render(
        <ClienteList clientes={[]} onEdit={onEdit} onDelete={onDelete} />
      );

      expect(
        screen.getByText("No hay clientes registrados")
      ).toBeInTheDocument();
    });

    it("should show Estado de Cuenta badge with color and text", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      // Check for badges with text (not just color)
      const badges = screen.getAllByText(/Activo|Inactivo|Bloqueado/);
      expect(badges.length).toBeGreaterThan(0);

      // Verify badges are visible (AC-006: always paired with text)
      expect(screen.getByText("Activo")).toBeInTheDocument();
      expect(screen.getByText("Inactivo")).toBeInTheDocument();
      expect(screen.getByText("Bloqueado")).toBeInTheDocument();
    });
  });

  describe("Search functionality", () => {
    it("should filter clientes by nombre", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        "Buscar por nombre, DNI o email..."
      );
      await user.type(searchInput, "Ana");

      expect(screen.getByText("Ana García")).toBeInTheDocument();
      expect(screen.queryByText("Carlos López")).not.toBeInTheDocument();
      expect(screen.queryByText("Beatriz Martínez")).not.toBeInTheDocument();
    });

    it("should filter clientes by DNI", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        "Buscar por nombre, DNI o email..."
      );
      await user.type(searchInput, "30.123.456");

      expect(screen.getByText("Ana García")).toBeInTheDocument();
      expect(screen.queryByText("Carlos López")).not.toBeInTheDocument();
    });

    it("should filter clientes by email", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        "Buscar por nombre, DNI o email..."
      );
      await user.type(searchInput, "carlos@");

      expect(screen.getByText("Carlos López")).toBeInTheDocument();
      expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
    });

    it("should show no results message when search yields nothing", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        "Buscar por nombre, DNI o email..."
      );
      await user.type(searchInput, "nonexistent");

      expect(screen.getByText("No se encontraron resultados")).toBeInTheDocument();
    });

    it("should be case-insensitive", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        "Buscar por nombre, DNI o email..."
      );
      await user.type(searchInput, "ana garcía");

      expect(screen.getByText("Ana García")).toBeInTheDocument();
    });
  });

  describe("Sorting functionality", () => {
    it("should sort by nombre (ascending)", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      // Component initializes with sortField="nombre" and sortAsc=true (ascending)
      // First click inverts it to descending, so we need two clicks to get back to ascending
      const nombreHeader = screen.getByText("Nombre");
      await user.click(nombreHeader); // First click: toggle to descending
      await user.click(nombreHeader); // Second click: toggle back to ascending

      const table = screen.getByRole("table");
      const rows = table.querySelectorAll("tbody tr");
      expect(rows[0]).toHaveTextContent("Ana García");
      expect(rows[1]).toHaveTextContent("Beatriz Martínez");
      expect(rows[2]).toHaveTextContent("Carlos López");
    });

    it("should reverse sort when clicking same column", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const nombreHeader = screen.getByText("Nombre");
      const table = screen.getByRole("table");

      // Component starts with sortAsc=true (ascending), sortField="nombre"
      // First click inverts to descending
      await user.click(nombreHeader);
      let rows = table.querySelectorAll("tbody tr");
      expect(rows[0]).toHaveTextContent("Carlos López"); // Descending order

      // Second click inverts back to ascending
      await user.click(nombreHeader);
      rows = table.querySelectorAll("tbody tr");
      expect(rows[0]).toHaveTextContent("Ana García"); // Ascending order
    });
  });

  describe("Actions (Edit and Delete)", () => {
    it("should call onEdit when Edit button clicked", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const editButtons = screen.getAllByText("Editar");
      await user.click(editButtons[0]);

      expect(onEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "cliente-1",
          nombre: "Ana García",
        })
      );
    });

    it("should call onDelete when Delete button clicked with confirmation", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      window.confirm = jest.fn(() => true);

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const deleteButtons = screen.getAllByText("Eliminar");
      await user.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalledWith(
        "¿Estás seguro de que querés eliminar este cliente?"
      );
      expect(onDelete).toHaveBeenCalledWith("cliente-1");
    });

    it("should not delete when confirmation is cancelled", async () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const user = userEvent.setup();

      window.confirm = jest.fn(() => false);

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const deleteButtons = screen.getAllByText("Eliminar");
      await user.click(deleteButtons[0]);

      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe("Membership labels", () => {
    it("should display membership ID if no label provided", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      const gold1Elements = screen.getAllByText("gold-1");
      const silver1Elements = screen.getAllByText("silver-1");
      
      expect(gold1Elements.length).toBeGreaterThan(0);
      expect(silver1Elements.length).toBeGreaterThan(0);
    });

    it("should display membership label when provided", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const membresiaLabels = {
        "gold-1": "Gold - $150.00",
        "silver-1": "Silver - $99.99",
      };

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
          membresiaLabels={membresiaLabels}
        />
      );

      const goldElements = screen.getAllByText("Gold - $150.00");
      const silverElements = screen.getAllByText("Silver - $99.99");
      
      expect(goldElements.length).toBeGreaterThan(0);
      expect(silverElements.length).toBeGreaterThan(0);
      expect(screen.queryByText("gold-1")).not.toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("should show loading message when isLoading is true", () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      render(
        <ClienteList
          clientes={mockClientes}
          onEdit={onEdit}
          onDelete={onDelete}
          isLoading={true}
        />
      );

      expect(screen.getByText("Cargando...")).toBeInTheDocument();
    });
  });
});
