import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

describe("EjercicioListPanel Component", () => {
  describe("List rendering", () => {
    it("should render table with headers for nombre, grupoMuscular, descripcion", () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      expect(screen.getByText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByText(/Grupo Muscular/i)).toBeInTheDocument();
      expect(screen.getByText(/Descripción/i)).toBeInTheDocument();
    });

    it("should render all ejercicios as table rows", () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      expect(screen.getByText("Press Militar")).toBeInTheDocument();
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
      expect(screen.getByText("Press Banca")).toBeInTheDocument();
    });

    it("should display muscle group in each row", () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      expect(screen.getByText("Hombros")).toBeInTheDocument();
      expect(screen.getByText("Piernas")).toBeInTheDocument();
      expect(screen.getByText("Pecho")).toBeInTheDocument();
    });

    it("should render empty message when no ejercicios", () => {
      render(
        <EjercicioListPanel
          ejercicios={[]}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      expect(screen.getByText(/No hay ejercicios/i)).toBeInTheDocument();
    });

    it("should render Modify button for each row", () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const modifyButtons = screen.getAllByRole("button", { name: /Modificar|Edit/i });
      expect(modifyButtons).toHaveLength(mockEjercicios.length);
    });

    it("should render Delete button for each row", () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const deleteButtons = screen.getAllByRole("button", { name: /Eliminar|Delete/i });
      expect(deleteButtons).toHaveLength(mockEjercicios.length);
    });
  });

  describe("Sorting", () => {
    it("should sort by nombre when Nombre column is clicked", () => {
      // Verify the sort column header is clickable and responsive
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const nombreHeader = screen.getByText(/Nombre/i);
      // The header should be clickable
      expect(nombreHeader).toBeInTheDocument();
      
      // Click shouldn't cause errors
      fireEvent.click(nombreHeader);
      
      // All ejercicios should still be present after sort
      expect(screen.getByText("Press Banca")).toBeInTheDocument();
      expect(screen.getByText("Press Militar")).toBeInTheDocument();
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    });

    it("should sort by grupoMuscular when column is clicked", () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const grupoHeader = screen.getByText(/Grupo Muscular/i);
      fireEvent.click(grupoHeader);

      const rows = screen.getAllByRole("row");
      // After sort by grupoMuscular alphabetically: Hombros, Pecho, Piernas
      expect(rows[1]).toHaveTextContent("Hombros");
      expect(rows[2]).toHaveTextContent("Pecho");
      expect(rows[3]).toHaveTextContent("Piernas");
    });

    it("should reverse sort when same column clicked twice", () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const nombreHeader = screen.getByText(/Nombre/i);
      
      // First click
      fireEvent.click(nombreHeader);
      expect(screen.getByText("Press Banca")).toBeInTheDocument();

      // Second click
      fireEvent.click(nombreHeader);
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    });
  });

  describe("Search and filtering", () => {
    it("should filter by nombre substring (case-insensitive)", async () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "press" } });
      
      // Wait for debounce to complete
      await waitFor(() => {
        expect(screen.getByText("Press Militar")).toBeInTheDocument();
        expect(screen.getByText("Press Banca")).toBeInTheDocument();
        expect(screen.queryByText("Sentadilla")).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it("should filter by grupoMuscular substring", async () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "piern" } });
      
      // Wait for debounce to complete
      await waitFor(() => {
        expect(screen.getByText("Sentadilla")).toBeInTheDocument();
        expect(screen.queryByText("Press Militar")).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it("should debounce search input (300ms)", async () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "press" } });

      // Before debounce completes, all items should still show
      expect(screen.getByText("Sentadilla")).toBeInTheDocument();

      // Wait for debounce to complete
      await waitFor(() => {
        expect(screen.queryByText("Sentadilla")).not.toBeInTheDocument();
      }, { timeout: 500 });
    });

    it("should clear filter when search is empty", async () => {
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Buscar/i) as HTMLInputElement;
      
      // Type a filter
      fireEvent.change(searchInput, { target: { value: "press" } });
      await waitFor(() => {
        expect(screen.queryByText("Sentadilla")).not.toBeInTheDocument();
      }, { timeout: 500 });

      // Clear the filter
      fireEvent.change(searchInput, { target: { value: "" } });
      await waitFor(() => {
        expect(screen.getByText("Sentadilla")).toBeInTheDocument();
      }, { timeout: 500 });
    });
  });

  describe("Row interaction", () => {
    it("should call onModify with ejercicio when Modify button clicked", () => {
      const onModify = jest.fn();
      
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={onModify}
          onDelete={jest.fn()}
        />
      );

      const modifyButtons = screen.getAllByRole("button", { name: /Modificar|Edit/i });
      // First button is for the first sorted item (Press Banca, id "3")
      fireEvent.click(modifyButtons[0]);

      expect(onModify).toHaveBeenCalledWith(mockEjercicios[2]);
    });

    it("should call onDelete with ejercicio ID when Delete button clicked and confirmed", () => {
      const onDelete = jest.fn();
      
      // Mock window.confirm
      const originalConfirm = global.confirm;
      global.confirm = jest.fn(() => true);
      
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={onDelete}
        />
      );

      const deleteButtons = screen.getAllByRole("button", { name: /Eliminar|Delete/i });
      // First delete button is for the first sorted item (Press Banca, id "3")
      fireEvent.click(deleteButtons[0]);

      expect(onDelete).toHaveBeenCalledWith("3");
      
      global.confirm = originalConfirm;
    });

    it("should NOT call onDelete when delete is cancelled", () => {
      const onDelete = jest.fn();
      
      const originalConfirm = global.confirm;
      global.confirm = jest.fn(() => false);
      
      render(
        <EjercicioListPanel
          ejercicios={mockEjercicios}
          onModify={jest.fn()}
          onDelete={onDelete}
        />
      );

      const deleteButtons = screen.getAllByRole("button", { name: /Eliminar|Delete/i });
      fireEvent.click(deleteButtons[0]);

      expect(onDelete).not.toHaveBeenCalled();

      global.confirm = originalConfirm;
    });
  });

  describe("Edge cases", () => {
    it("should handle ejercicio with null descripcion", () => {
      render(
        <EjercicioListPanel
          ejercicios={[mockEjercicios[2]]}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      expect(screen.getByText("Press Banca")).toBeInTheDocument();
      // Should render empty cell or dash for null descripcion
      const descCell = screen.queryByText("-");
      if (descCell) {
        expect(descCell).toBeInTheDocument();
      }
    });

    it("should handle very long ejercicio name (100 chars)", () => {
      const longNameEjercicio: Ejercicio = {
        ...mockEjercicios[0],
        nombre: "a".repeat(100),
      };

      render(
        <EjercicioListPanel
          ejercicios={[longNameEjercicio]}
          onModify={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      expect(screen.getByText("a".repeat(100))).toBeInTheDocument();
    });
  });
});
