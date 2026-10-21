import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EjercicioConUso } from "@/domains/ejercicio/ejercicio";
import { buildEjercicio } from "../../../tests/factories/ejercicio";
import { EjercicioListPanel } from "./ejercicio-list";

/** Un ejercicio del catálogo importado (D-70). */
const ej = (n: number, extra: Partial<EjercicioConUso> = {}): EjercicioConUso => ({
  ...buildEjercicio({
    id: `e${n}`,
    nombre: `Ejercicio ${String(n).padStart(3, "0")}`,
    grupoMuscular: "Pecho",
    equipamiento: "Barra",
    musculoObjetivo: "Pectorales",
    mediaId: `${String(n).padStart(4, "0")}-abc`,
  }),
  enRutinas: 0,
  ...extra,
});

const filasDeDatos = () => screen.getAllByRole("row").slice(1); // sin el encabezado

describe("EjercicioListPanel con el catálogo (D-70)", () => {
  it("muestra la miniatura del ejercicio junto a su nombre", () => {
    const { container } = render(<EjercicioListPanel ejercicios={[ej(1)]} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/ejercicios/0001-abc.jpg");
  });

  describe("paginación en el cliente", () => {
    const ciento20 = Array.from({ length: 120 }, (_, i) => ej(i + 1));

    it("muestra 50 filas y cuántas faltan, sin renderizar las 120", () => {
      render(<EjercicioListPanel ejercicios={ciento20} />);
      expect(filasDeDatos()).toHaveLength(50);
      expect(screen.getByText("Mostrando 50 de 120 ejercicios")).toBeInTheDocument();
    });

    it("'Ver más ejercicios' suma de a 50 y desaparece al llegar al final", async () => {
      render(<EjercicioListPanel ejercicios={ciento20} />);
      await userEvent.click(screen.getByRole("button", { name: "Ver más ejercicios" }));
      expect(filasDeDatos()).toHaveLength(100);
      await userEvent.click(screen.getByRole("button", { name: "Ver más ejercicios" }));
      expect(filasDeDatos()).toHaveLength(120);
      expect(screen.queryByRole("button", { name: "Ver más ejercicios" })).not.toBeInTheDocument();
    });

    it("con pocos ejercicios no muestra ni el botón ni el contador", () => {
      render(<EjercicioListPanel ejercicios={[ej(1), ej(2)]} />);
      expect(screen.queryByRole("button", { name: "Ver más ejercicios" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
    });

    it("al cambiar la búsqueda vuelve a empezar desde 50", async () => {
      const { rerender } = render(<EjercicioListPanel ejercicios={ciento20} />);
      await userEvent.click(screen.getByRole("button", { name: "Ver más ejercicios" }));
      expect(filasDeDatos()).toHaveLength(100);
      rerender(<EjercicioListPanel ejercicios={ciento20} searchTerm="Ejercicio" />);
      expect(filasDeDatos()).toHaveLength(50);
    });

    it("el ejercicio seleccionado siempre queda a la vista, aunque esté más allá de la página", () => {
      render(<EjercicioListPanel ejercicios={ciento20} selectedId="e90" />);
      expect(screen.getByText("Ejercicio 090")).toBeInTheDocument();
    });
  });

  describe("filtros", () => {
    const mezcla = [
      ej(1, { grupoMuscular: "Pecho", equipamiento: "Barra" }),
      ej(2, { grupoMuscular: "Pecho", equipamiento: "Mancuerna" }),
      ej(3, { grupoMuscular: "Espalda", equipamiento: "Mancuerna" }),
      ej(4, { grupoMuscular: "Cuello", equipamiento: "Peso corporal" }),
    ];

    it("filtra por grupo muscular", async () => {
      render(<EjercicioListPanel ejercicios={mezcla} />);
      await userEvent.selectOptions(screen.getByLabelText("Grupo muscular"), "Espalda");
      expect(filasDeDatos()).toHaveLength(1);
      expect(screen.getByText("Ejercicio 003")).toBeInTheDocument();
    });

    it("filtra por equipamiento", async () => {
      render(<EjercicioListPanel ejercicios={mezcla} />);
      await userEvent.selectOptions(screen.getByLabelText("Equipamiento"), "Mancuerna");
      expect(filasDeDatos()).toHaveLength(2);
    });

    it("combina grupo y equipamiento", async () => {
      render(<EjercicioListPanel ejercicios={mezcla} />);
      await userEvent.selectOptions(screen.getByLabelText("Grupo muscular"), "Pecho");
      await userEvent.selectOptions(screen.getByLabelText("Equipamiento"), "Mancuerna");
      expect(filasDeDatos()).toHaveLength(1);
      expect(screen.getByText("Ejercicio 002")).toBeInTheDocument();
    });

    it("las opciones salen de los datos, ordenadas, sin repetir ni incluir vacíos", () => {
      render(<EjercicioListPanel ejercicios={[...mezcla, ej(5, { equipamiento: null })]} />);
      const opciones = within(screen.getByLabelText("Equipamiento"))
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(opciones).toEqual(["Todo el equipamiento", "Barra", "Mancuerna", "Peso corporal"]);
    });

    it("sin ningún equipamiento cargado (ejercicios a mano) no muestra el filtro de equipamiento", () => {
      render(<EjercicioListPanel ejercicios={[ej(1, { equipamiento: null }), ej(2, { equipamiento: null })]} />);
      expect(screen.queryByLabelText("Equipamiento")).not.toBeInTheDocument();
    });

    it("avisa cuando los filtros no dejan ningún ejercicio", async () => {
      render(<EjercicioListPanel ejercicios={mezcla} />);
      await userEvent.selectOptions(screen.getByLabelText("Grupo muscular"), "Cuello");
      await userEvent.selectOptions(screen.getByLabelText("Equipamiento"), "Barra");
      expect(screen.getByText("No hay ejercicios con esos filtros.")).toBeInTheDocument();
    });
  });

  it("la búsqueda también encuentra por equipamiento y por músculo, sin tildes", () => {
    const lista = [
      ej(1, { equipamiento: "Mancuerna", musculoObjetivo: "Bíceps" }),
      ej(2, { equipamiento: "Barra", musculoObjetivo: "Pectorales" }),
    ];
    const { rerender } = render(<EjercicioListPanel ejercicios={lista} searchTerm="mancuerna" />);
    expect(filasDeDatos()).toHaveLength(1);
    rerender(<EjercicioListPanel ejercicios={lista} searchTerm="biceps" />);
    expect(screen.getByText("Ejercicio 001")).toBeInTheDocument();
    expect(filasDeDatos()).toHaveLength(1);
  });
});
