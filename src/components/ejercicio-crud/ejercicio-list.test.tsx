import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjercicioListPanel } from "./ejercicio-list";
import { Ejercicio } from "@prisma/client";

const mockEjercicios: Ejercicio[] = [
  {
    id: "1",
    nombre: "Press Militar",
    grupoMuscular: "Hombros",
    descripcion: "Empuje vertical",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    nombre: "Sentadilla",
    grupoMuscular: "Piernas",
    descripcion: "Ejercicio de piernas",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    nombre: "Press Banca",
    grupoMuscular: "Pecho",
    descripcion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("EjercicioListPanel", () => {
  it("renderiza las columnas exactas del mockup", () => {
    render(<EjercicioListPanel ejercicios={mockEjercicios} />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Grupo")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
  });

  it("renderiza todas las filas con su badge de estado", () => {
    render(<EjercicioListPanel ejercicios={mockEjercicios} />);
    expect(screen.getByText("Press Militar")).toBeInTheDocument();
    expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByText("Press Banca")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("no renderiza botones por fila (Modificar/Eliminar viven en la ActionBar)", () => {
    render(<EjercicioListPanel ejercicios={mockEjercicios} />);
    expect(screen.queryByRole("button", { name: /Modificar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar/i })).not.toBeInTheDocument();
  });

  it("muestra 'No hay ejercicios' cuando la lista está vacía", () => {
    render(<EjercicioListPanel ejercicios={[]} />);
    expect(screen.getByText(/No hay ejercicios/i)).toBeInTheDocument();
  });

  it("selecciona una fila al hacer click y muestra el detalle", async () => {
    const onSelect = jest.fn();
    render(<EjercicioListPanel ejercicios={mockEjercicios} onSelect={onSelect} />);

    await userEvent.click(screen.getByText("Press Militar"));
    expect(onSelect).toHaveBeenCalledWith(mockEjercicios[0]);
  });

  it("marca la fila seleccionada y muestra su detalle", () => {
    render(<EjercicioListPanel ejercicios={mockEjercicios} selectedId="1" />);
    const rows = screen.getAllByRole("row");
    // rows[0] = header, rows[1] = first data row (sorted: Press Banca, Press Militar, Sentadilla)
    const selected = rows.find((r) => r.getAttribute("aria-selected") === "true");
    expect(selected).toHaveClass("bg-[#FDEDE4]");
    expect(screen.getByText("Empuje vertical")).toBeInTheDocument();
  });

  it("filtra por nombre y grupo con el término recibido", () => {
    render(<EjercicioListPanel ejercicios={mockEjercicios} searchTerm="piern" />);
    expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    expect(screen.queryByText("Press Militar")).not.toBeInTheDocument();
  });

  it("muestra el aviso cuando el filtro no encuentra nada", () => {
    render(<EjercicioListPanel ejercicios={mockEjercicios} searchTerm="zzz" />);
    expect(screen.getByText(/No se encontraron ejercicios/i)).toBeInTheDocument();
  });

  // H12: la búsqueda pliega tildes. "triceps" (sin tilde) encuentra "Tríceps".
  it("encuentra el ejercicio buscando sin tildes", () => {
    const conTilde: Ejercicio[] = [
      {
        id: "9",
        nombre: "Tríceps en polea",
        grupoMuscular: "Brazos",
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    render(<EjercicioListPanel ejercicios={conTilde} searchTerm="triceps" />);
    expect(screen.getByText("Tríceps en polea")).toBeInTheDocument();
  });

  it("encuentra el ejercicio con tilde en el término aunque el dato no la tenga", () => {
    const sinTilde: Ejercicio[] = [
      {
        id: "9",
        nombre: "Triceps en polea",
        grupoMuscular: "Brazos",
        descripcion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    render(<EjercicioListPanel ejercicios={sinTilde} searchTerm="Tríceps" />);
    expect(screen.getByText("Triceps en polea")).toBeInTheDocument();
  });

  // H-7: orden por columna reutilizando el helper compartido (toggleSort/compareSortValues).
  const nombresEnOrden = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[1].textContent);

  it("ordena por Grupo muscular al clickear la columna", async () => {
    const user = userEvent.setup();
    render(<EjercicioListPanel ejercicios={mockEjercicios} />);

    await user.click(screen.getByRole("button", { name: "Grupo" }));

    // Hombros (Press Militar), Pecho (Press Banca), Piernas (Sentadilla).
    expect(nombresEnOrden()).toEqual(["Press Militar", "Press Banca", "Sentadilla"]);
  });

  it("ordena por Nombre y alterna el sentido al segundo click", async () => {
    const user = userEvent.setup();
    render(<EjercicioListPanel ejercicios={mockEjercicios} />);

    const header = screen.getByRole("button", { name: "Nombre" });
    await user.click(header);
    expect(nombresEnOrden()).toEqual(["Press Banca", "Press Militar", "Sentadilla"]);

    await user.click(header);
    expect(nombresEnOrden()).toEqual(["Sentadilla", "Press Militar", "Press Banca"]);
  });
});
