import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RutinaListPanel } from "./rutina-list";
import type { RutinaWithCount } from "@/api/rutinas";

const rutinas: RutinaWithCount[] = [
  {
    id: "rutina-alpha",
    nombre: "Alpha",
    objetivoPrincipal: "Fuerza",
    frecuenciaSemanal: 3,
    duracionEstimada: 60,
    nivelDeDificultad: "BASICO",
    descripcion: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    _count: { ejercicios: 5 },
  } as RutinaWithCount,
  {
    id: "rutina-zeta",
    nombre: "Zeta",
    objetivoPrincipal: "Hipertrofia",
    frecuenciaSemanal: 5,
    duracionEstimada: 90,
    nivelDeDificultad: "AVANZADO",
    descripcion: null,
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    _count: { ejercicios: 1 },
  } as RutinaWithCount,
];

/** Nombre por fila (índice 1 = Nombre). */
const nombres = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1]?.textContent);

describe("RutinaListPanel — orden por columna (spec: Nombre, Objetivo, Frecuencia, Duración, Nivel)", () => {
  it("ordena numéricamente por Ejercicios asc y luego desc", async () => {
    render(<RutinaListPanel rutinas={rutinas} />);
    expect(nombres()).toEqual(["Alpha", "Zeta"]);

    const header = screen.getByRole("columnheader", { name: "Ejercicios" });

    await userEvent.click(within(header).getByRole("button"));
    expect(nombres()).toEqual(["Zeta", "Alpha"]);
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(within(header).getByText("▲")).toBeInTheDocument();

    await userEvent.click(within(header).getByRole("button"));
    expect(nombres()).toEqual(["Alpha", "Zeta"]);
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(within(header).getByText("▼")).toBeInTheDocument();
  });

  it("ordena por Nivel asc y desc", async () => {
    render(<RutinaListPanel rutinas={rutinas} />);
    const header = screen.getByRole("columnheader", { name: "Nivel" });

    await userEvent.click(within(header).getByRole("button"));
    expect(nombres()).toEqual(["Zeta", "Alpha"]); // "Avanzado" antes que "Básico"

    await userEvent.click(within(header).getByRole("button"));
    expect(nombres()).toEqual(["Alpha", "Zeta"]);
  });
});
