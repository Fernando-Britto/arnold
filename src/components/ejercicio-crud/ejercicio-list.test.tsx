import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

// Sorted por nombre asc por defecto: Press Banca (3), Press Militar (1), Sentadilla (2)
const expandRow = (nombre: string) => {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`Ver detalle de ${nombre}`, "i") }));
};

describe("EjercicioListPanel Component", () => {
  describe("List rendering", () => {
    it("should render column headers for nombre and grupoMuscular", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      expect(screen.getByText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByText(/Grupo Muscular/i)).toBeInTheDocument();
    });

    it("should render all ejercicios as collapsed rows", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      expect(screen.getByText("Press Militar")).toBeInTheDocument();
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
      expect(screen.getByText("Press Banca")).toBeInTheDocument();
    });

    it("should display muscle group in each collapsed row", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      expect(screen.getByText("Hombros")).toBeInTheDocument();
      expect(screen.getByText("Piernas")).toBeInTheDocument();
      expect(screen.getByText("Pecho")).toBeInTheDocument();
    });

    it("should render empty message when no ejercicios", () => {
      render(<EjercicioListPanel ejercicios={[]} onModify={jest.fn()} onDelete={jest.fn()} />);
      expect(screen.getByText(/No hay ejercicios/i)).toBeInTheDocument();
    });

    it("should NOT show Modificar/Eliminar buttons until a row is expanded", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      expect(screen.queryByRole("button", { name: /Modificar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Eliminar/i })).not.toBeInTheDocument();
    });
  });

  describe("Expand / collapse", () => {
    it("shows descripción and action buttons when a row is expanded", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      expandRow("Press Militar");
      expect(screen.getByText("Empuje vertical")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Modificar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Eliminar/i })).toBeInTheDocument();
    });

    it("collapses again on second click, hiding action buttons", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      expandRow("Press Militar");
      expect(screen.getByRole("button", { name: /Modificar/i })).toBeInTheDocument();
      expandRow("Press Militar");
      expect(screen.queryByRole("button", { name: /Modificar/i })).not.toBeInTheDocument();
    });

    it("allows more than one row expanded at the same time", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      expandRow("Press Militar");
      expandRow("Sentadilla");
      expect(screen.getAllByRole("button", { name: /Modificar/i })).toHaveLength(2);
    });

    it("shows a dash when descripción is null", () => {
      render(<EjercicioListPanel ejercicios={[mockEjercicios[2]]} onModify={jest.fn()} onDelete={jest.fn()} />);
      expandRow("Press Banca");
      expect(screen.getByText("-")).toBeInTheDocument();
    });
  });

  describe("Sorting", () => {
    it("should sort by nombre when Nombre column is clicked", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      fireEvent.click(screen.getByText(/Nombre/i));
      expect(screen.getByText("Press Banca")).toBeInTheDocument();
      expect(screen.getByText("Press Militar")).toBeInTheDocument();
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    });

    it("should sort by grupoMuscular when column is clicked", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      fireEvent.click(screen.getByText(/Grupo Muscular/i));
      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("Hombros");
      expect(rows[2]).toHaveTextContent("Pecho");
      expect(rows[3]).toHaveTextContent("Piernas");
    });

    it("should reverse sort when same column clicked twice", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      const nombreHeader = screen.getByText(/Nombre/i);
      fireEvent.click(nombreHeader);
      expect(screen.getByText("Press Banca")).toBeInTheDocument();
      fireEvent.click(nombreHeader);
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    });
  });

  describe("Search and filtering", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("should filter by nombre substring (case-insensitive)", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "press" } });
      act(() => {
        jest.advanceTimersByTime(350);
      });
      expect(screen.getByText("Press Militar")).toBeInTheDocument();
      expect(screen.getByText("Press Banca")).toBeInTheDocument();
      expect(screen.queryByText("Sentadilla")).not.toBeInTheDocument();
    });

    it("should filter by grupoMuscular substring", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "piern" } });
      act(() => {
        jest.advanceTimersByTime(350);
      });
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
      expect(screen.queryByText("Press Militar")).not.toBeInTheDocument();
    });

    it("should debounce search input (300ms)", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "press" } });
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(350);
      });
      expect(screen.queryByText("Sentadilla")).not.toBeInTheDocument();
    });

    it("should clear filter when search is empty", () => {
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={jest.fn()} />);
      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "press" } });
      act(() => {
        jest.advanceTimersByTime(350);
      });
      expect(screen.queryByText("Sentadilla")).not.toBeInTheDocument();
      fireEvent.change(searchInput, { target: { value: "" } });
      act(() => {
        jest.advanceTimersByTime(350);
      });
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    });
  });

  describe("Row interaction", () => {
    it("should call onModify with the ejercicio when Modificar is clicked inside the detail", () => {
      const onModify = jest.fn();
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={onModify} onDelete={jest.fn()} />);
      expandRow("Press Banca");
      fireEvent.click(screen.getByRole("button", { name: /Modificar/i }));
      expect(onModify).toHaveBeenCalledWith(mockEjercicios[2]);
    });

    it("should call onDelete with the id when Eliminar is confirmed", () => {
      const onDelete = jest.fn();
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={onDelete} />);
      expandRow("Press Banca");
      fireEvent.click(screen.getByRole("button", { name: /Eliminar/i }));
      expect(onDelete).toHaveBeenCalledWith("3");
      confirmSpy.mockRestore();
    });

    it("should NOT call onDelete when delete is cancelled", () => {
      const onDelete = jest.fn();
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
      render(<EjercicioListPanel ejercicios={mockEjercicios} onModify={jest.fn()} onDelete={onDelete} />);
      expandRow("Press Banca");
      fireEvent.click(screen.getByRole("button", { name: /Eliminar/i }));
      expect(onDelete).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe("Edge cases", () => {
    it("should handle very long ejercicio name (100 chars)", () => {
      const longNameEjercicio: Ejercicio = { ...mockEjercicios[0], nombre: "a".repeat(100) };
      render(<EjercicioListPanel ejercicios={[longNameEjercicio]} onModify={jest.fn()} onDelete={jest.fn()} />);
      expect(screen.getByText("a".repeat(100))).toBeInTheDocument();
    });
  });
});
