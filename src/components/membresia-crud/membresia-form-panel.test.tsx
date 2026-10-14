/**
 * Integration tests for MembresiaFormPanel
 * Tests form submission → API POST/PUT → callback flow with AC-005 warning
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiaFormPanel } from "./membresia-form-panel";
import { useNotifications } from "@/contexts/notifications";

jest.mock("@/contexts/notifications");
const mockNotify = jest.fn();

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
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
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
    it("should display deactivation warning when changing estado to INACTIVA with assigned socios", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      // First response: deactivation warning
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          code: "DEACTIVATION_WARNING",
          message: "5 socios tienen esta membresía asignada",
        }),
      });

      render(
        <MembresiaFormPanel
          initialData={mockMembresia}
          isEdit={true}
        />
      );

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
      });

      // Change estado from ACTIVA to INACTIVA
      const estadoSelect = screen.getByLabelText(/Estado/i) as HTMLSelectElement;
      await user.selectOptions(estadoSelect, "INACTIVA");

      // Submit
      const saveButton = screen.getByRole("button", { name: /Guardar/i });
      await user.click(saveButton);

      // Wait for warning to appear
      await waitFor(() => {
        expect(screen.getByText(/5 socios/i)).toBeInTheDocument();
      });

      // Verify warning is displayed
      expect(screen.getByText(/Advertencia de Desactivación/i)).toBeInTheDocument();
      expect(screen.getByText(/5 socios tienen esta membresía asignada/i)).toBeInTheDocument();
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

  describe("T-023b: avisos de éxito y mensajes de error de la API", () => {
    async function fillAndSubmitCreate(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText(/Nombre/i), "Platinum");
      await user.type(screen.getByLabelText(/Precio/i), "25000");
      await user.type(screen.getByLabelText(/Periodicidad/i), "30");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));
    }

    it("al crear avisa 'Membresía creada'", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockMembresia, id: "new-id" }),
      });

      render(<MembresiaFormPanel isEdit={false} />);
      await fillAndSubmitCreate(user);

      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Membresía creada"));
    });

    it("al editar avisa 'Membresía actualizada'", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => mockMembresia });

      render(<MembresiaFormPanel initialData={mockMembresia} isEdit={true} />);
      await user.click(screen.getByRole("button", { name: /Guardar/i }));

      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Membresía actualizada"));
    });

    it("un 400 de validación muestra el mensaje del servidor y no avisa éxito", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: "VALIDATION_DUPLICATE_NAME", message: "Ya existe una membresía con ese nombre" }),
      });

      render(<MembresiaFormPanel isEdit={false} />);
      await fillAndSubmitCreate(user);

      expect(await screen.findByText("Ya existe una membresía con ese nombre")).toBeInTheDocument();
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it("un 401 muestra el aviso de sesión vencida, no el código del servidor", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ code: "TOKEN_INVALID", message: "TOKEN_INVALID" }),
      });

      render(<MembresiaFormPanel isEdit={false} />);
      await fillAndSubmitCreate(user);

      expect(await screen.findByText(/Tu sesión venció/i)).toBeInTheDocument();
      expect(screen.queryByText("TOKEN_INVALID")).not.toBeInTheDocument();
    });

    it("un 5xx con cuerpo que no es JSON no muestra el detalle técnico", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      });

      render(<MembresiaFormPanel isEdit={false} />);
      await fillAndSubmitCreate(user);

      expect(await screen.findByText(/No se pudo procesar la solicitud/i)).toBeInTheDocument();
      expect(screen.queryByText(/Unexpected token/i)).not.toBeInTheDocument();
    });

    it("si no hay conexión avisa que no hay conexión", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("Failed to fetch"));

      render(<MembresiaFormPanel isEdit={false} />);
      await fillAndSubmitCreate(user);

      expect(await screen.findByText(/No hay conexión con el servidor/i)).toBeInTheDocument();
    });

    it("confirmar la desactivación también avisa 'Membresía actualizada'", async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ code: "DEACTIVATION_WARNING", message: "5 socios tienen esta membresía asignada" }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockMembresia, estado: "INACTIVA" }) });

      render(<MembresiaFormPanel initialData={mockMembresia} isEdit={true} />);
      await user.selectOptions(screen.getByLabelText(/Estado/i), "INACTIVA");
      await user.click(screen.getByRole("button", { name: /Guardar/i }));
      await user.click(await screen.findByRole("button", { name: /desactivar de todas formas/i }));

      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Membresía actualizada"));
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

  describe("N6: guard de doble submit", () => {
    it("dos submits seguidos hacen UN solo POST (no crea dos filas)", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      let resolveFetch: (value: unknown) => void = () => {};
      mockFetch.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFetch = resolve; })
      );

      render(<MembresiaFormPanel isEdit={false} />);

      await user.type(screen.getByLabelText(/Nombre/i), "Platinum");
      await user.type(screen.getByLabelText(/Precio/i), "25000");
      await user.type(screen.getByLabelText(/Periodicidad/i), "30");

      const form = screen
        .getByRole("button", { name: /Guardar/i })
        .closest("form") as HTMLFormElement;

      // Dos envíos en el mismo tick: el Segundo debe rebotar contra el guard de reentrada.
      fireEvent.submit(form);
      fireEvent.submit(form);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch({ ok: true, json: async () => ({ ...mockMembresia, id: "new-id" }) });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("success", "Membresía creada"));
    });
  });
});
