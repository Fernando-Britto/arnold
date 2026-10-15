import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MembresiaListPanel,
  type MembresiaListItem,
} from "./membresia-list-panel";

const membresias: MembresiaListItem[] = [
  {
    id: "11111111gold",
    nombre: "Gold",
    precio: 15000,
    periodicidad: 30,
    descripcion: "Premium",
    estado: "ACTIVA",
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedSocioCount: 42,
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
    assignedSocioCount: 0,
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
    expect(screen.getByText("$ 15.000")).toBeInTheDocument();
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
    expect(selected).toHaveClass("bg-[#FDEDE4]");
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("filtra por nombre", () => {
    render(<MembresiaListPanel membresias={membresias} searchTerm="sil" />);
    expect(screen.getByText("Silver")).toBeInTheDocument();
    expect(screen.queryByText("Gold")).not.toBeInTheDocument();
  });

  it("filtra ignorando acentos: 'basico' matchea 'Básico' (N5)", () => {
    const conAcento: MembresiaListItem[] = [
      { ...membresias[0], id: "basico-1", nombre: "Básico" },
    ];
    render(<MembresiaListPanel membresias={conAcento} searchTerm="basico" />);
    expect(screen.getByText("Básico")).toBeInTheDocument();
  });

  it("muestra el estado de carga", () => {
    render(<MembresiaListPanel membresias={[]} isLoading />);
    expect(screen.getByText(/Cargando membresías/i)).toBeInTheDocument();
  });

  it("muestra el estado vacío", () => {
    render(<MembresiaListPanel membresias={[]} />);
    expect(screen.getByText(/No hay membresías/i)).toBeInTheDocument();
  });

  it("renderiza la columna Miembros con el conteo de socios asignados (AC-007)", () => {
    render(<MembresiaListPanel membresias={membresias} />);
    expect(screen.getByRole("columnheader", { name: "Miembros" })).toBeInTheDocument();

    const rows = screen.getAllByRole("row").slice(1);
    const miembrosPorFila = rows.map(
      (row) => within(row).getAllByRole("cell")[5]?.textContent,
    );
    expect(miembrosPorFila).toEqual(["42", "0"]);
  });

  describe("orden por columna (spec: Nombre, Precio, Periodicidad, Estado)", () => {
    const nombres = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[1]?.textContent);

    it("ordena numéricamente por Precio asc y luego desc", async () => {
      render(<MembresiaListPanel membresias={membresias} />);
      expect(nombres()).toEqual(["Gold", "Silver"]);

      const header = screen.getByRole("columnheader", { name: "Precio" });

      await userEvent.click(within(header).getByRole("button"));
      expect(nombres()).toEqual(["Silver", "Gold"]);
      expect(header).toHaveAttribute("aria-sort", "ascending");
      expect(within(header).getByText("▲")).toBeInTheDocument();

      await userEvent.click(within(header).getByRole("button"));
      expect(nombres()).toEqual(["Gold", "Silver"]);
      expect(header).toHaveAttribute("aria-sort", "descending");
      expect(within(header).getByText("▼")).toBeInTheDocument();
    });

    it("mantiene Miembros como columna no ordenable (spec)", () => {
      render(<MembresiaListPanel membresias={membresias} />);
      const header = screen.getByRole("columnheader", { name: "Miembros" });
      expect(within(header).queryByRole("button")).not.toBeInTheDocument();
      expect(header).not.toHaveAttribute("aria-sort");
    });
  });
});
