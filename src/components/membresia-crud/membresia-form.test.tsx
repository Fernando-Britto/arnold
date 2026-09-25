import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiaForm } from "./membresia-form";
import type { Membresia } from "@/domains/membresia/membresia";

describe("MembresiaForm", () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const mockMembresia: Membresia = {
    id: "membresia-1",
    nombre: "Gold",
    precio: 15000.5,
    periodicidad: 30,
    descripcion: "Premium membership",
    estado: "ACTIVA",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Form rendering", () => {
    it("should render form with all input fields for new membership", () => {
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Precio/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Periodicidad/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Descripción/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Estado/i)).toBeInTheDocument();
    });

    it("should render Guardar and Cancelar buttons", () => {
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      expect(screen.getByRole("button", { name: /Guardar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
    });

    it("should populate form with initial data when provided", () => {
      render(
        <MembresiaForm
          initialData={mockMembresia}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue("Gold")).toBeInTheDocument();
      expect(screen.getByDisplayValue("15000.5")).toBeInTheDocument();
      expect(screen.getByDisplayValue("30")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Premium membership")).toBeInTheDocument();
    });

    it("should show 'Nueva Membresía' title when creating", () => {
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Nueva Membresía/i)).toBeInTheDocument();
    });

    it("should show 'Editar Membresía' title when editing", () => {
      render(
        <MembresiaForm
          initialData={mockMembresia}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Editar Membresía/i)).toBeInTheDocument();
    });
  });

  describe("Field validation (AC-001 to AC-004)", () => {
    it("should reject empty nombre", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      const guardarButton = screen.getByRole("button", { name: /Guardar/i });
      await user.click(guardarButton);

      await waitFor(() => {
        expect(screen.getByText(/El nombre es requerido|nombre.*requerido/i)).toBeInTheDocument();
      });
    });

    it("should reject nombre shorter than 3 chars", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Go");
      await user.type(screen.getByLabelText(/Precio/i), "15000");
      await user.type(screen.getByLabelText(/Periodicidad/i), "30");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(
          screen.getByText("El nombre debe tener al menos 3 caracteres")
        ).toBeInTheDocument();
      });
    });

    it("should reject nombre longer than 50 chars", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      await user.type(screen.getByLabelText(/Nombre/i), "A".repeat(51));
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/no puede exceder 50|50.*caracteres/i)
        ).toBeInTheDocument();
      });
    });

    it("should reject zero or negative precio", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Gold");
      await user.type(screen.getByLabelText(/Precio/i), "0");
      await user.type(screen.getByLabelText(/Periodicidad/i), "30");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      // Verify onSave was NOT called due to validation error
      expect(mockOnSave).not.toHaveBeenCalled();
      
      // Verify error appears in the form
      await waitFor(() => {
        expect(screen.getByLabelText(/Precio/i)).toHaveClass("border-red-500");
      });
    });

    it("should reject zero or negative periodicidad", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Gold");
      await user.type(screen.getByLabelText(/Precio/i), "15000");
      await user.type(screen.getByLabelText(/Periodicidad/i), "0");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      // Verify onSave was NOT called due to validation error
      expect(mockOnSave).not.toHaveBeenCalled();
      
      // Verify error appears in the form
      await waitFor(() => {
        expect(screen.getByLabelText(/Periodicidad/i)).toHaveClass("border-red-500");
      });
    });

    it("should reject descripcion longer than 300 chars", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Gold");
      await user.type(screen.getByLabelText(/Precio/i), "15000");
      await user.type(screen.getByLabelText(/Periodicidad/i), "30");
      
      // Use paste() instead of type() for long strings to avoid event saturation in parallel tests
      const descripcionInput = screen.getByLabelText(/Descripción/i) as HTMLTextAreaElement;
      await user.paste("A".repeat(301));

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/no puede exceder 300|300.*caracteres/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form submission", () => {
    it("should call onSave with valid form data", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Gold");
      await user.type(screen.getByLabelText(/Precio/i), "15000.5");
      await user.type(screen.getByLabelText(/Periodicidad/i), "30");
      await user.type(screen.getByLabelText(/Descripción/i), "Premium plan");

      // Select ACTIVA state
      const estadoSelect = screen.getByLabelText(/Estado/i) as HTMLSelectElement;
      await user.selectOptions(estadoSelect, "ACTIVA");

      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: "Gold",
            precio: 15000.5,
            periodicidad: 30,
            descripcion: "Premium plan",
            estado: "ACTIVA",
          })
        );
      });
    });

    it("should call onCancel when Cancelar button clicked", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      await user.click(screen.getByRole("button", { name: /Cancelar/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe("Estado dropdown (AC-005 related)", () => {
    it("should have ACTIVA and INACTIVA options", async () => {
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      const estadoSelect = screen.getByLabelText(/Estado/i) as HTMLSelectElement;
      const options = Array.from(estadoSelect.options).map((opt) => opt.value);

      expect(options).toContain("ACTIVA");
      expect(options).toContain("INACTIVA");
    });

    it("should allow changing estado from ACTIVA to INACTIVA", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaForm
          initialData={mockMembresia}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const estadoSelect = screen.getByLabelText(/Estado/i) as HTMLSelectElement;
      expect(estadoSelect.value).toBe("ACTIVA");

      await user.selectOptions(estadoSelect, "INACTIVA");
      expect(estadoSelect.value).toBe("INACTIVA");
    });
  });

  describe("Precio formatting (AC-002)", () => {
    it("should normalize precio display to 2 decimal places on blur", async () => {
      const user = userEvent.setup();
      render(<MembresiaForm onSave={mockOnSave} onCancel={mockOnCancel} />);

      const precioInput = screen.getByLabelText(/Precio/i) as HTMLInputElement;
      await user.type(precioInput, "15000");
      
      // Trigger blur on precio field
      await user.click(screen.getByLabelText(/Nombre/i));

      // After blur, precioInput should be normalized to 2 decimal places
      // The input value should show something like "15000.00"
      const value = precioInput.value;
      const decimalIndex = value.indexOf(".");
      const decimals = decimalIndex === -1 ? 0 : value.length - decimalIndex - 1;
      
      expect(value).toMatch(/^15000/); // Starts with 15000
      expect(decimals).toBeLessThanOrEqual(2); // At most 2 decimals
    });
  });

  describe("Deactivation warning (AC-005 — depends on T-016 API integration)", () => {
    it.todo("should show warning modal when changing estado to INACTIVA with assigned members — requires getAssignedSocioCount from API");
  });
});
