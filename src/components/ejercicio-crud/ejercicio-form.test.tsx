import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjercicioForm } from "./ejercicio-form";
import { Ejercicio } from "@prisma/client";

const mockEjercicio: Ejercicio = {
  id: "1",
  nombre: "Press Militar",
  grupoMuscular: "Hombros",
  descripcion: "Empuje vertical",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("EjercicioForm Component", () => {
  describe("Form rendering", () => {
    it("should render form with empty fields in create mode", () => {
      const onSave = jest.fn();
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      expect(screen.getByLabelText(/Nombre/i)).toHaveValue("");
      expect(screen.getByLabelText(/Grupo Muscular/i)).toHaveValue("");
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue("");
    });

    it("should render form populated with initial data in edit mode", () => {
      const onSave = jest.fn();
      render(<EjercicioForm onSave={onSave} initialData={mockEjercicio} />);

      expect(screen.getByLabelText(/Nombre/i)).toHaveValue("Press Militar");
      expect(screen.getByLabelText(/Grupo Muscular/i)).toHaveValue("Hombros");
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue("Empuje vertical");
    });

    it("should render ID field as read-only in edit mode", () => {
      const onSave = jest.fn();
      render(<EjercicioForm onSave={onSave} initialData={mockEjercicio} />);

      const idField = screen.getByDisplayValue("1") as HTMLInputElement;
      expect(idField).toBeDisabled();
    });

    it("should render muscle group dropdown with predefined options", () => {
      const onSave = jest.fn();
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      const grupoSelect = screen.getByLabelText(/Grupo Muscular/i) as HTMLSelectElement;
      const options = Array.from(grupoSelect.options).map(o => o.value);
      
      // Verify predefined muscle groups exist
      expect(options).toContain("Pecho");
      expect(options).toContain("Espalda");
      expect(options).toContain("Piernas");
      expect(options).toContain("Hombros");
    });

    it("should render submit button labeled 'Guardar'", () => {
      const onSave = jest.fn();
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
    });
  });

  describe("Form submission - valid input", () => {
    it("should call onSave with form data on valid submission", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Sentadilla");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Piernas");
      await user.type(screen.getByLabelText(/Descripción/i), "Ejercicio de piernas");
      
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          nombre: "Sentadilla",
          grupoMuscular: "Piernas",
          descripcion: "Ejercicio de piernas",
        });
      });
    });

    it("should call onSave with only required fields if descripcion is empty", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Press Banca");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          nombre: "Press Banca",
          grupoMuscular: "Pecho",
          descripcion: "",
        });
      });
    });

    it("should trim whitespace from nombre before submission", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "  Press  ");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Press",
          })
        );
      });
    });
  });

  describe("Form validation - required fields", () => {
    it("should show error for missing nombre", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Campo requerido/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for missing grupoMuscular", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Press");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Campo requerido/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for whitespace-only nombre", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "   ");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Campo requerido/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("Form validation - length constraints", () => {
    it("should show error for nombre below 3 characters", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "ab");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Mínimo 3 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for nombre exceeding 100 characters", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      const longName = "a".repeat(101);
      await user.type(screen.getByLabelText(/Nombre/i), longName);
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Máximo 100 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for descripcion exceeding 500 characters", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup({ delay: null }); // Configure setup to skip delays
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      const longDesc = "d".repeat(501);
      await user.type(screen.getByLabelText(/Nombre/i), "Press");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      await user.type(screen.getByLabelText(/Descripción/i), longDesc);
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Máximo 500 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("Form edit mode", () => {
    it("should include ID in submission when editing", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={mockEjercicio} />);

      await user.clear(screen.getByLabelText(/Descripción/i));
      await user.type(screen.getByLabelText(/Descripción/i), "Updated description");
      
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "1",
          })
        );
      });
    });

    it("should show error when updating with invalid nombre", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={mockEjercicio} />);

      await user.clear(screen.getByLabelText(/Nombre/i));
      await user.type(screen.getByLabelText(/Nombre/i), "ab");
      
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Mínimo 3 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("Form interaction feedback", () => {
    it("should disable submit button while loading", () => {
      const onSave = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      render(<EjercicioForm onSave={onSave} initialData={null} isLoading={true} />);

      const submitButton = screen.getByRole("button", { name: /Guardar/i }) as HTMLButtonElement;
      expect(submitButton).toBeDisabled();
    });

    it("should show validation error inline next to field", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "ab");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      
      // Trigger blur to show validation
      fireEvent.blur(screen.getByLabelText(/Nombre/i));

      await waitFor(() => {
        expect(screen.getByText(/Mínimo 3 caracteres/i)).toBeInTheDocument();
      });
    });
  });

  describe("Form reset", () => {
    it("should clear form after successful submission", async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      
      render(<EjercicioForm onSave={onSave} initialData={null} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Press");
      await user.selectOptions(screen.getByLabelText(/Grupo Muscular/i), "Pecho");
      
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toHaveValue("");
      });
    });
  });
});
