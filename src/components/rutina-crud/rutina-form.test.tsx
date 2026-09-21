import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RutinaForm } from "./rutina-form";
import { Rutina, Ejercicio } from "@prisma/client";

const mockRutina: Rutina = {
  id: "1",
  nombre: "Full Body",
  objetivoPrincipal: "Hipertrofia",
  frecuenciaSemanal: 3,
  duracionEstimada: 60,
  nivelDeDificultad: "INTERMEDIO",
  descripcion: "Rutina de cuerpo completo",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEjercicios: Ejercicio[] = [
  {
    id: "1",
    nombre: "Press Banca",
    grupoMuscular: "Pecho",
    descripcion: "Ejercicio de pecho",
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
];

describe("RutinaForm Component", () => {
  describe("Form rendering", () => {
    it("should render all 6 fields in create mode", () => {
      const onSave = jest.fn();
      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Objetivo Principal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Frecuencia Semanal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duración Estimada/i)).toBeInTheDocument();
      expect(screen.getByText(/Nivel de Dificultad/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Descripción/i)).toBeInTheDocument();
    });

    it("should render form with empty fields in create mode", () => {
      const onSave = jest.fn();
      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      expect(screen.getByLabelText(/Nombre/i)).toHaveValue("");
      expect(screen.getByLabelText(/Objetivo Principal/i)).toHaveValue("");
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue("");
    });

    it("should render form populated with initial data in edit mode", () => {
      const onSave = jest.fn();
      render(
        <RutinaForm
          onSave={onSave}
          initialData={mockRutina}
          availableEjercicios={mockEjercicios}
        />
      );

      expect(screen.getByLabelText(/Nombre/i)).toHaveValue("Full Body");
      expect(screen.getByLabelText(/Objetivo Principal/i)).toHaveValue(
        "Hipertrofia"
      );
      expect(screen.getByLabelText(/Descripción/i)).toHaveValue(
        "Rutina de cuerpo completo"
      );
    });

    it("should render ID field as read-only in edit mode", () => {
      const onSave = jest.fn();
      render(
        <RutinaForm
          onSave={onSave}
          initialData={mockRutina}
          availableEjercicios={mockEjercicios}
        />
      );

      const idField = screen.getByDisplayValue("1") as HTMLInputElement;
      expect(idField).toBeDisabled();
    });

    it("should render radio buttons for difficulty levels", () => {
      const onSave = jest.fn();
      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      expect(screen.getByLabelText("Básico")).toBeInTheDocument();
      expect(screen.getByLabelText("Intermedio")).toBeInTheDocument();
      expect(screen.getByLabelText("Avanzado")).toBeInTheDocument();
    });

    it("should render EjercicioEnRutinaList subsection", () => {
      const onSave = jest.fn();
      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      expect(screen.getByText(/Ejercicios de la rutina/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Agregar Ejercicio/i })).toBeInTheDocument();
    });
  });

  describe("Form submission - valid input", () => {
    it("should call onSave with form data on valid submission", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "Rutina A");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "4");
      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "90");
      await user.click(screen.getByLabelText("Intermedio"));
      await user.type(
        screen.getByLabelText(/Descripción/i),
        "Mi rutina favorita"
      );

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Rutina A",
            objetivoPrincipal: "Hipertrofia",
            frecuenciaSemanal: 4,
            duracionEstimada: 90,
            nivelDeDificultad: "Intermedio",
            descripcion: "Mi rutina favorita",
            ejercicios: [],
          })
        );
      });
    });

    it("should include exercises in submission payload", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      const initialData = {
        ...mockRutina,
        ejercicios: [
          {
            ejercicioId: "1",
            ejercicioNombre: "Press Banca",
            series: 3,
            repeticiones: 10,
            descanso: 60,
          },
        ],
      };

      render(
        <RutinaForm
          onSave={onSave}
          initialData={initialData}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            ejercicios: expect.arrayContaining([
              expect.objectContaining({
                ejercicioId: "1",
                ejercicioNombre: "Press Banca",
              }),
            ]),
          })
        );
      });
    });

    it("should trim whitespace from nombre before submission", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "  Rutina  ");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Rutina",
          })
        );
      });
    });
  });

  describe("Form validation - required fields", () => {
    it("should show error for missing nombre", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/El nombre es requerido/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for missing objetivoPrincipal", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "Rutina");
      await user.click(screen.getByLabelText("Básico"));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        const errorMessages = screen.getAllByText(/Campo requerido/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for whitespace-only nombre", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "   ");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/El nombre es requerido/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("Form validation - length constraints", () => {
    it("should show error for nombre below 3 characters", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "ab");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/El nombre debe tener al menos 3 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for nombre exceeding 100 characters", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      const longName = "a".repeat(101);
      await user.type(screen.getByLabelText(/Nombre/i), longName);
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/El nombre no puede exceder 100 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for descripcion exceeding 500 characters", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      const longDesc = "d".repeat(501);
      await user.type(screen.getByLabelText(/Nombre/i), "Rutina");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));
      await user.type(screen.getByLabelText(/Descripción/i), longDesc);
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/La descripción no puede exceder 500 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    }, 10000);

    it("should show error for frecuenciaSemanal outside range 1-7", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.clear(screen.getByLabelText(/Frecuencia Semanal/i));
      await user.type(screen.getByLabelText(/Frecuencia Semanal/i), "8");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Debe estar entre 1 y 7/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should show error for duracionEstimada <= 0", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.clear(screen.getByLabelText(/Duración Estimada/i));
      await user.type(screen.getByLabelText(/Duración Estimada/i), "0");
      await user.type(screen.getByLabelText(/Nombre/i), "Rutina");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByText(/Debe ser mayor a 0/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("Form edit mode", () => {
    it("should include ID in submission when editing", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={mockRutina}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.clear(screen.getByLabelText(/Descripción/i));
      await user.type(
        screen.getByLabelText(/Descripción/i),
        "Updated description"
      );

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "1",
          })
        );
      });
    });
  });

  describe("Form interaction feedback", () => {
    it("should disable submit button while loading", () => {
      const onSave = jest.fn();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
          isLoading={true}
        />
      );

      const submitButton = screen.getByRole("button", {
        name: /Guardar/i,
      }) as HTMLButtonElement;
      expect(submitButton).toBeDisabled();
    });

    it("should show validation error inline next to field", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "ab");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );

      // Trigger blur to show validation
      fireEvent.blur(screen.getByLabelText(/Nombre/i));

      await waitFor(() => {
        expect(screen.getByText(/Mínimo 3 caracteres/i)).toBeInTheDocument();
      });
    });

    it("should clear errors on field change", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "ab");
      fireEvent.blur(screen.getByLabelText(/Nombre/i));

      await waitFor(() => {
        expect(screen.getByText(/Mínimo 3 caracteres/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Nombre/i), "c"); // Now "abc"

      await waitFor(() => {
        expect(screen.queryByText(/Mínimo 3 caracteres/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Form reset", () => {
    it("should clear form after successful submission in create mode", async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={null}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.type(screen.getByLabelText(/Nombre/i), "Rutina");
      await user.selectOptions(
        screen.getByLabelText(/Objetivo Principal/i),
        "Hipertrofia"
      );
      await user.click(screen.getByLabelText("Básico"));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toHaveValue("");
      });
    });

    it("should not clear form after successful submission in edit mode", async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <RutinaForm
          onSave={onSave}
          initialData={mockRutina}
          availableEjercicios={mockEjercicios}
        />
      );

      await user.clear(screen.getByLabelText(/Descripción/i));
      await user.type(
        screen.getByLabelText(/Descripción/i),
        "Updated description"
      );

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toHaveValue("Full Body");
      });
    });
  });
});
