import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaquinaList } from "./maquina-list";
import type { Maquina } from "@/domains/maquina/maquina";

const maquinas: Maquina[] = [
  {
    id: "maq001",
    nombre: "Polea alta",
    ubicacion: "Sala principal",
    tipoEquipamiento: "MAQUINA_GUIADA",
    estado: "DISPONIBLE",
    fechaAlta: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "maq002",
    nombre: "Banco press",
    ubicacion: "Sala musculación",
    tipoEquipamiento: "PESO_LIBRE",
    estado: "OCUPADA",
    fechaAlta: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "maq003",
    nombre: "Cinta de correr",
    ubicacion: "Cardio zone",
    tipoEquipamiento: "CARDIO",
    estado: "INACTIVA",
    fechaAlta: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "maq004",
    nombre: "Pólea de bíceps",
    ubicacion: "Sala funcional",
    tipoEquipamiento: "MAQUINA_GUIADA",
    estado: "DISPONIBLE",
    fechaAlta: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
];

describe("MaquinaList", () => {
  it("renderiza las columnas ID, Nombre, Ubicación, Tipo y Estado", () => {
    render(<MaquinaList maquinas={maquinas} />);

    expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ubicación" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tipo" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Estado" })).toBeInTheDocument();
  });

  it("renderiza las filas con nombre, ubicación, tipo y el distintivo de estado", () => {
    render(<MaquinaList maquinas={maquinas} />);

    expect(screen.getByText("Polea alta")).toBeInTheDocument();
    expect(screen.getByText("Sala principal")).toBeInTheDocument();
    expect(screen.getByText("Sala musculación")).toBeInTheDocument();
    expect(screen.getAllByText("Máquina guiada").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Peso libre").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Cardio").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Disponible").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ocupada").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Inactiva").length).toBeGreaterThanOrEqual(1);
  });

  it("muestra el ID abreviado con prefijo MQ", () => {
    render(<MaquinaList maquinas={maquinas} />);

    expect(screen.getByText("MQ-Q001")).toBeInTheDocument();
  });

  it("filtra por estado, incluyendo OCUPADA", async () => {
    const user = userEvent.setup();
    render(<MaquinaList maquinas={maquinas} />);

    await user.selectOptions(screen.getByLabelText(/Filtrar por estado/i), "OCUPADA");

    expect(screen.getByText("Banco press")).toBeInTheDocument();
    expect(screen.queryByText("Polea alta")).not.toBeInTheDocument();
    expect(screen.queryByText("Cinta de correr")).not.toBeInTheDocument();
  });

  it("filtra por tipo de equipamiento", async () => {
    const user = userEvent.setup();
    render(<MaquinaList maquinas={maquinas} />);

    await user.selectOptions(screen.getByLabelText(/Filtrar por tipo/i), "CARDIO");

    expect(screen.getByText("Cinta de correr")).toBeInTheDocument();
    expect(screen.queryByText("Polea alta")).not.toBeInTheDocument();
    expect(screen.queryByText("Banco press")).not.toBeInTheDocument();
  });

  it("busca por nombre sin distinguir mayúsculas ni acentos", async () => {
    const user = userEvent.setup();
    render(<MaquinaList maquinas={maquinas} />);

    await user.type(screen.getByLabelText(/Buscar por nombre/i), "polea");

    expect(screen.getByText("Polea alta")).toBeInTheDocument();
    expect(screen.getByText("Pólea de bíceps")).toBeInTheDocument();
    expect(screen.queryByText("Banco press")).not.toBeInTheDocument();
  });

  it("combina los tres filtros", async () => {
    const user = userEvent.setup();
    render(<MaquinaList maquinas={maquinas} />);

    await user.type(screen.getByLabelText(/Buscar por nombre/i), "p");
    await user.selectOptions(screen.getByLabelText(/Filtrar por estado/i), "DISPONIBLE");
    await user.selectOptions(screen.getByLabelText(/Filtrar por tipo/i), "MAQUINA_GUIADA");

    expect(screen.getByText("Polea alta")).toBeInTheDocument();
    expect(screen.getByText("Pólea de bíceps")).toBeInTheDocument();
    expect(screen.queryByText("Banco press")).not.toBeInTheDocument();
    expect(screen.queryByText("Cinta de correr")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío", () => {
    render(<MaquinaList maquinas={[]} />);

    expect(screen.getByText(/No hay máquinas/i)).toBeInTheDocument();
  });

  it("muestra el mensaje sin resultados cuando ninguna fila coincide", async () => {
    const user = userEvent.setup();
    render(<MaquinaList maquinas={maquinas} />);

    await user.type(screen.getByLabelText(/Buscar por nombre/i), "zzz");

    expect(screen.getByText(/No se encontraron máquinas/i)).toBeInTheDocument();
  });

  it("muestra el estado de carga", () => {
    render(<MaquinaList maquinas={[]} isLoading />);

    expect(screen.getByText(/Cargando máquinas/i)).toBeInTheDocument();
  });

  it("llama a onSelect al hacer clic en una fila", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<MaquinaList maquinas={maquinas} onSelect={onSelect} />);

    await user.click(screen.getByText("Banco press"));

    expect(onSelect).toHaveBeenCalledWith(maquinas[1]);
  });

  it("marca la fila controlada por selectedId", () => {
    render(<MaquinaList maquinas={maquinas} selectedId="maq002" />);

    const selected = screen
      .getAllByRole("row")
      .find((row) => row.getAttribute("aria-selected") === "true");
    expect(selected).toHaveTextContent("Banco press");
  });

  describe("orden por columna", () => {
    const nombres = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[1]?.textContent);

    it("ordena por nombre ascendente por defecto", () => {
      render(<MaquinaList maquinas={maquinas} />);
      expect(nombres()).toEqual([
        "Banco press",
        "Cinta de correr",
        "Polea alta",
        "Pólea de bíceps",
      ]);
    });

    it("ordena por ubicación al hacer clic en la cabecera", async () => {
      const user = userEvent.setup();
      render(<MaquinaList maquinas={maquinas} />);

      const header = screen.getByRole("columnheader", { name: "Ubicación" });
      await user.click(within(header).getByRole("button"));

      expect(header).toHaveAttribute("aria-sort", "ascending");
      expect(nombres()).toEqual([
        "Cinta de correr",
        "Pólea de bíceps",
        "Banco press",
        "Polea alta",
      ]);
    });
  });
});
