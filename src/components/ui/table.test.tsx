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
  FLEX_BASE,
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
    expect(nombre).toHaveClass("text-meta", "font-bold", "text-ink-soft");
    const header = screen.getByRole("row");
    expect(header).toHaveClass("h-[52px]", "bg-surface-subtle", "rounded-t-lg");
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
    expect(screen.getByText("primaria")).toHaveClass("text-ink-soft");
    expect(screen.getByText("secundaria")).toHaveClass("text-ink-muted");
  });

  it("reparte el ancho entre todas las columnas en proporción a su medida", () => {
    render(
      <Table>
        <TableHeader columns={columns} />
        <TableRow>
          <TableCell width={100}>id</TableCell>
          <TableCell>nombre</TableCell>
          <TableCell width={102}>estado</TableCell>
        </TableRow>
      </Table>,
    );

    // La columna que declara `width` crece tanto como mide...
    for (const celda of [screen.getAllByRole("columnheader")[0], screen.getByText("id")]) {
      expect(celda).toHaveStyle(`flex-grow: 100; flex-basis: 100px; flex-shrink: 1`);
    }
    // ...y la principal (sin `width`) arranca desde FLEX_BASE, así no se come todo el ancho.
    for (const celda of [screen.getAllByRole("columnheader")[1], screen.getByText("nombre")]) {
      expect(celda).toHaveStyle(
        `flex-grow: ${FLEX_BASE}; flex-basis: ${FLEX_BASE}px; flex-shrink: 1`,
      );
    }
  });

  it("TableRow marca aria-selected y pinta la fila desplegada en la light-brand", () => {
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
    // Fila desplegada: light-brand suave, sin el naranja a plena saturación ni texto blanco.
    expect(rows[0]).toHaveClass("bg-brand-soft");
    expect(rows[0]).not.toHaveClass("bg-brand");
    expect(rows[1]).toHaveAttribute("aria-selected", "false");
  });

  describe("chevron de despliegue", () => {
    it("la cabecera reserva la zona del chevron cuando disclosure está activo", () => {
      const { container } = render(<TableHeader columns={columns} disclosure />);
      const row = screen.getByRole("row");

      // La zona reservada es fija (40px) y decorativa.
      expect(row.lastElementChild).toHaveAttribute("aria-hidden", "true");
      expect(row.lastElementChild).toHaveStyle("width: 40px");
      // Sigue habiendo una sola columna por dato.
      expect(container.querySelectorAll('[role="columnheader"]')).toHaveLength(columns.length);
    });

    it("sin disclosure la cabecera no agrega la zona", () => {
      render(<TableHeader columns={columns} />);
      expect(screen.getByRole("row").children).toHaveLength(columns.length);
    });

    it("la fila cerrada muestra el chevron hacia abajo y en gris", () => {
      render(
        <Table>
          <TableRow disclosure onClick={() => {}}>
            <TableCell>fila</TableCell>
          </TableRow>
        </Table>,
      );

      const chevron = document.querySelector("[data-disclosure-indicator]");
      expect(chevron).toBeInTheDocument();
      expect(chevron).toHaveClass("text-ink-disabled");
      expect(chevron).not.toHaveClass("rotate-180");
    });

    it("la fila desplegada gira el chevron hacia arriba y lo pinta naranja", () => {
      render(
        <Table>
          <TableRow disclosure selected onClick={() => {}}>
            <TableCell>fila</TableCell>
          </TableRow>
        </Table>,
      );

      const chevron = document.querySelector("[data-disclosure-indicator]");
      expect(chevron).toHaveClass("rotate-180", "text-brand");
    });
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
    expect(badge).toHaveClass("bg-success-soft", "h-[23px]");
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

      expect(screen.getByText("Nombre")).toHaveClass("text-meta", "font-bold");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
