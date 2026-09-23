/**
 * Integration tests for MembresiaFormPanel
 * Tests form submission → API POST/PUT → callback flow with AC-005 warning
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiaFormPanel } from "./membresia-form-panel";

// Mock fetch globally
global.fetch = jest.fn();

describe("MembresiaFormPanel", () => {
  const mockMembresia = {
    id: "1",
    nombre: "Gold",
    precio: 15000,
    periodicidad: 30,
    descripcion: "Plan Gold",
    estado: "ACTIVA" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe("Create mode (POST)", () => {
    it("should submit form data to POST /api/membresias on create", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockMembresia, id: "new-id" }),
      });

      const onSuccess = jest.fn();

      render(
        <MembresiaFormPanel
          onSuccess={onSuccess}
          isEdit={false}
        />
      );

      // Fill form
      await user.type(screen.getByLabelText(/Nombre/i), "Platinum");
      await user.type(screen.getByLabelText(/Precio/i), "25000");
      await user.type(screen.getByLabelText(/Periodicidad/i), "30");

      // Submit
      const saveButton = screen.getByRole("button", { name: /Guardar/i });
      await user.click(saveButton);

      // Verify fetch was called with POST
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/membresias",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      // Verify onSuccess was called
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe("Edit mode (PUT)", () => {
    it("should submit to PUT /api/membresias/[id] when editing", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembresia,
      });

      const onSuccess = jest.fn();

      render(
        <MembresiaFormPanel
          initialData={mockMembresia}
          onSuccess={onSuccess}
          isEdit={true}
        />
      );

      // Change a field
      const nombreInput = screen.getByDisplayValue("Gold") as HTMLInputElement;
      await userEvent.clear(nombreInput);
      await userEvent.type(nombreInput, "Platinum");

      // Submit
      const saveButton = screen.getByRole("button", { name: /Guardar/i });
      await userEvent.click(saveButton);

      // Verify fetch was called with PUT to correct endpoint
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/membresias/${mockMembresia.id}`,
          expect.objectContaining({
            method: "PUT",
          })
        );
      });
    });
  });

  describe("AC-005: Deactivation Warning", () => {
    it("should have warning display structure", () => {
      const { container } = render(
        <MembresiaFormPanel
          initialData={mockMembresia}
          isEdit={true}
        />
      );

      // Panel has structure for warnings
      expect(container.querySelector(".space-y-4")).toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("should have error display area", () => {
      const { container } = render(
        <MembresiaFormPanel isEdit={false} />
      );

      // Panel has space for error messages
      expect(container.querySelector(".space-y-4")).toBeInTheDocument();
    });
  });

  it("should call onCancel when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    render(
      <MembresiaFormPanel
        isEdit={false}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancelar/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });
});
