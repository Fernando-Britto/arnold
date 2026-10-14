import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableStatusBadge,
  TableDetailRow,
  type TableColumn,
} from "./table";

const columns: TableColumn[] = [
  { key: "id", label: "ID", width: 100 },
  { key: "nombre", label: "Nombre" },
  { key: "estado", label: "Estado", width: 102 },
];

describe("Table kit", () => {
  it("TableHeader renderiza los labels con el estilo del spec", () => {
    render(<TableHeader columns={columns} />);
    const nombre = screen.getByText("Nombre");
    expect(nombre).toHaveClass("text-[13px]", "font-bold", "text-[#71717A]");
    const header = screen.getByRole("row");
    expect(header).toHaveClass("h-[52px]", "bg-[#F4F4F5]", "rounded-t-lg");
  });

  it("TableCell aplica variantes primaria/secundaria", () => {
    render(
      <Table>
        <TableRow>
          <TableCell>primaria</TableCell>
          <TableCell variant="secondary">secundaria</TableCell>
        </TableRow>
      </Table>,
    );
    expect(screen.getByText("primaria")).toHaveClass("text-[#333333]");
    expect(screen.getByText("secundaria")).toHaveClass("text-[#71717A]");
  });

  it("TableRow marca aria-selected y pinta la fila seleccionada", () => {
    render(
      <Table>
        <TableRow selected onClick={() => {}}>
          <TableCell>uno</TableCell>
        </TableRow>
        <TableRow onClick={() => {}}>
          <TableCell>dos</TableCell>
        </TableRow>
      </Table>,
    );
    const rows = screen.getAllByRole("row");
    expect(rows[0]).toHaveAttribute("aria-selected", "true");
    expect(rows[0]).toHaveClass("bg-[#FC4C02]");
    expect(rows[1]).toHaveAttribute("aria-selected", "false");
  });

  it("TableRow dispara onClick al hacer click", async () => {
    const onClick = jest.fn();
    render(
      <Table>
        <TableRow onClick={onClick}>
          <TableCell>fila</TableCell>
        </TableRow>
      </Table>,
    );
    await userEvent.click(screen.getByText("fila"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("TableStatusBadge usa el estilo success por defecto", () => {
    render(<TableStatusBadge>Activo</TableStatusBadge>);
    const badge = screen.getByText("Activo");
    expect(badge).toHaveClass("bg-[#DEF7EC]", "h-[23px]");
  });

  it("TableDetailRow usa el padding y gap del spec", () => {
    render(
      <Table>
        <TableDetailRow>
          <p>detalle</p>
        </TableDetailRow>
      </Table>,
    );
    expect(screen.getByText("detalle")).toBeInTheDocument();
    expect(screen.getByRole("row")).toHaveClass("gap-4", "px-12", "pb-6");
  });

  describe("ordenamiento opt-in", () => {
    const sortableColumns: TableColumn[] = [
      { key: "nombre", label: "Nombre", sortable: true },
      { key: "estado", label: "Estado" },
    ];

    it("marca aria-sort en la columna activa y expone un botón accesible", async () => {
      const onSort = jest.fn();
      render(
        <TableHeader
          columns={sortableColumns}
          sort={{ key: "nombre", direction: "asc" }}
          onSort={onSort}
        />,
      );

      const header = screen.getByRole("columnheader", { name: "Nombre" });
      expect(header).toHaveAttribute("aria-sort", "ascending");
      expect(within(header).getByText("▲")).toBeInTheDocument();

      await userEvent.click(within(header).getByRole("button"));
      expect(onSort).toHaveBeenCalledWith("nombre");
    });

    it("refleja la dirección descendente en aria-sort e indicador", () => {
      render(
        <TableHeader
          columns={sortableColumns}
          sort={{ key: "nombre", direction: "desc" }}
          onSort={jest.fn()}
        />,
      );

      const header = screen.getByRole("columnheader", { name: "Nombre" });
      expect(header).toHaveAttribute("aria-sort", "descending");
      expect(within(header).getByText("▼")).toBeInTheDocument();
    });

    it("mantiene las columnas no sortables inalteradas y sin botón", () => {
      render(<TableHeader columns={sortableColumns} sort={null} onSort={jest.fn()} />);

      const header = screen.getByRole("columnheader", { name: "Estado" });
      expect(header).not.toHaveAttribute("aria-sort");
      expect(within(header).queryByRole("button")).not.toBeInTheDocument();
    });

    it("no altera el render sin onSort (compatibilidad)", () => {
      render(<TableHeader columns={sortableColumns} />);

      expect(screen.getByText("Nombre")).toHaveClass("text-[13px]", "font-bold");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
