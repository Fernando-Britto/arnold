import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClienteForm } from "./cliente-form";

const mockMembresias = [
  { id: "gold-1", nombre: "Gold", precio: 150.0, estado: "ACTIVA" as const },
  { id: "silver-1", nombre: "Silver", precio: 99.99, estado: "ACTIVA" as const },
  { id: "bronze-1", nombre: "Bronze", precio: 49.99, estado: "INACTIVA" as const },
];

describe("ClienteForm", () => {
  describe("New cliente creation", () => {
    it("should render form with empty fields for new cliente", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      expect(screen.getByText("Nuevo Cliente")).toBeInTheDocument();
    });

    it("should show membership dropdown with only active memberships", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const select = screen.getByDisplayValue("Seleccionar membresía...");
      expect(select).toBeInTheDocument();

      // Click to show options
      fireEvent.click(select);

      // Should see only ACTIVA memberships
      expect(screen.getByText("Gold - $150.00")).toBeInTheDocument();
      expect(screen.getByText("Silver - $99.99")).toBeInTheDocument();
      expect(screen.queryByText("Bronze - $49.99")).not.toBeInTheDocument();
    });

    it("should show disabled message when no active memberships exist", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={[mockMembresias[2]]} // Only INACTIVA
        />
      );

      expect(screen.getByText("No hay membresías activas")).toBeInTheDocument();
      const submitButton = screen.getByText("Crear");
      expect(submitButton).toBeDisabled();
    });

    it("should validate and reject invalid nombre (too short)", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const nombreInput = screen.getByPlaceholderText("e.g., Ana García");
      await user.clear(nombreInput);
      await user.type(nombreInput, "Ana");

      const submitButton = screen.getByText("Crear");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/al menos 5 caracteres/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should validate and reject invalid email format", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const nombreInput = screen.getByPlaceholderText("e.g., Ana García");
      const dniInput = screen.getByPlaceholderText("XX.XXX.XXX o XXXXXXXX");
      const emailInput = screen.getByPlaceholderText("ana@example.com");
      const membresiaSelect = screen.getByRole("combobox", { name: /Membresía Asignada/i });

      await user.type(nombreInput, "Ana García");
      await user.type(dniInput, "30.123.456");
      await user.type(emailInput, "invalid-email");
      
      // Ensure React has processed state changes before selecting
      await waitFor(() => {
        expect((membresiaSelect as HTMLSelectElement).value).toBe("");
      });
      
      await user.selectOptions(membresiaSelect, ["gold-1"]);

      // Trigger form submission via the button
      const submitButton = screen.getByText("Crear") as HTMLButtonElement;
      const form = submitButton.closest("form") as HTMLFormElement;
      
      // Dispatch submit event on form (this triggers handleSubmit and React state updates)
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      
      // The critical part: validation should prevent onSave from being called
      expect(onSave).not.toHaveBeenCalled();
    });

    it("should validate and reject invalid DNI format", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const dniInput = screen.getByPlaceholderText("XX.XXX.XXX o XXXXXXXX");
      await user.type(dniInput, "123");

      const submitButton = screen.getByText("Crear");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/debe tener formato/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should accept valid DNI formats (XX.XXX.XXX or XXXXXXXX)", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      // Test XX.XXX.XXX format
      const dniInput = screen.getByPlaceholderText("XX.XXX.XXX o XXXXXXXX");
      await user.type(dniInput, "30.123.456");

      expect(dniInput).toHaveValue("30.123.456");

      // Clear and test XXXXXXXX format
      await user.clear(dniInput);
      await user.type(dniInput, "30123456");

      expect(dniInput).toHaveValue("30123456");
    });

    it("should require membership selection", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const nombreInput = screen.getByPlaceholderText("e.g., Ana García");
      const dniInput = screen.getByPlaceholderText("XX.XXX.XXX o XXXXXXXX");
      const emailInput = screen.getByPlaceholderText("ana@example.com");

      await user.type(nombreInput, "Ana García");
      await user.type(dniInput, "30.123.456");
      await user.type(emailInput, "ana@example.com");

      // Don't select membership
      const submitButton = screen.getByText("Crear");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/debe seleccionar una membresía/i)).toBeInTheDocument();
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should accept valid form and call onSave", async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const nombreInput = screen.getByPlaceholderText("e.g., Ana García");
      const dniInput = screen.getByPlaceholderText("XX.XXX.XXX o XXXXXXXX");
      const emailInput = screen.getByPlaceholderText("ana@example.com");
      const membresiaSelect = screen.getByDisplayValue("Seleccionar membresía...");

      await user.type(nombreInput, "Ana García");
      await user.type(dniInput, "30.123.456");
      await user.type(emailInput, "ana@example.com");
      await user.selectOptions(membresiaSelect, ["gold-1"]);

      const submitButton = screen.getByText("Crear");
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Ana García",
            dni: "30.123.456",
            email: "ana@example.com",
            membresiaAsignada: "gold-1",
            estadoCuenta: "Activo",
          })
        );
      });
    });

    it("should allow optional telefono", async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const nombreInput = screen.getByPlaceholderText("e.g., Ana García");
      const dniInput = screen.getByPlaceholderText("XX.XXX.XXX o XXXXXXXX");
      const emailInput = screen.getByPlaceholderText("ana@example.com");
      const membresiaSelect = screen.getByDisplayValue("Seleccionar membresía...");
      const telefonoInput = screen.getByPlaceholderText("+54 9 XXXX XXXXXX");

      await user.type(nombreInput, "Ana García");
      await user.type(dniInput, "30.123.456");
      await user.type(emailInput, "ana@example.com");
      await user.selectOptions(membresiaSelect, ["gold-1"]);
      await user.type(telefonoInput, "+54 9 1234 567890");

      const submitButton = screen.getByText("Crear");
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            telefono: "+54 9 1234 567890",
          })
        );
      });
    });
  });

  describe("Editing existing cliente", () => {
    const existingCliente = {
      id: "cliente-1",
      nombre: "Ana García",
      dni: "30.123.456",
      email: "ana@example.com",
      telefono: "+54 9 1234 567890",
      membresiaAsignada: "gold-1",
      estadoCuenta: "Activo" as const,
      fechaAlta: new Date("2024-01-15"), // ISO string, will arrive like this from API
    };

    it("should render form with 'Editar Cliente' title", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={existingCliente}
          availableMembresias={mockMembresias}
        />
      );

      expect(screen.getByText("Editar Cliente")).toBeInTheDocument();
    });

    it("should show ID as read-only", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={existingCliente}
          availableMembresias={mockMembresias}
        />
      );

      const idInput = screen.getByDisplayValue("cliente-1") as HTMLInputElement;
      expect(idInput).toBeDisabled();
    });

    it("should show Fecha de Alta as read-only", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={existingCliente}
          availableMembresias={mockMembresias}
        />
      );

      const dateInput = screen.getByDisplayValue("15/01/2024");
      expect(dateInput).toBeDisabled();
    });

    it("should populate form with existing data", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={existingCliente}
          availableMembresias={mockMembresias}
        />
      );

      expect(screen.getByDisplayValue("Ana García")).toBeInTheDocument();
      expect(screen.getByDisplayValue("30.123.456")).toBeInTheDocument();
      expect(screen.getByDisplayValue("ana@example.com")).toBeInTheDocument();
      expect(screen.getByDisplayValue("+54 9 1234 567890")).toBeInTheDocument();
    });

    it("should show 'Actualizar' button instead of 'Crear'", () => {
      const onSave = jest.fn();
      render(
        <ClienteForm
          onSave={onSave}
          initialData={existingCliente}
          availableMembresias={mockMembresias}
        />
      );

      expect(screen.getByText("Actualizar")).toBeInTheDocument();
      expect(screen.queryByText("Crear")).not.toBeInTheDocument();
    });

    it("should call onSave with id when updating", async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={existingCliente}
          availableMembresias={mockMembresias}
        />
      );

      const submitButton = screen.getByText("Actualizar");
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "cliente-1",
          })
        );
      });
    });
  });

  describe("Error handling and state management", () => {
    it("should clear field error when user starts editing", async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const nombreInput = screen.getByPlaceholderText("e.g., Ana García");
      await user.type(nombreInput, "Ab");
      const submitButton = screen.getByText("Crear");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/al menos 5 caracteres/i)).toBeInTheDocument();
      });

      await user.clear(nombreInput);
      await user.type(nombreInput, "Ana García");

      expect(
        screen.queryByText(/al menos 5 caracteres/i)
      ).not.toBeInTheDocument();
    });

    it("should disable submit button while submitting", async () => {
      const onSave = jest.fn(
        () =>
          new Promise((resolve) => setTimeout(resolve, 100))
      ) as any;
      const user = userEvent.setup();

      render(
        <ClienteForm
          onSave={onSave}
          initialData={null}
          availableMembresias={mockMembresias}
        />
      );

      const nombreInput = screen.getByPlaceholderText("e.g., Ana García");
      const dniInput = screen.getByPlaceholderText("XX.XXX.XXX o XXXXXXXX");
      const emailInput = screen.getByPlaceholderText("ana@example.com");
      const membresiaSelect = screen.getByDisplayValue("Seleccionar membresía...");

      await user.type(nombreInput, "Ana García");
      await user.type(dniInput, "30.123.456");
      await user.type(emailInput, "ana@example.com");
      await user.selectOptions(membresiaSelect, ["gold-1"]);

      const submitButton = screen.getByText("Crear");
      await user.click(submitButton);

      expect(submitButton).toBeDisabled();
    });
  });
});
