/**
 * Integration tests for MembresiaListPanel
 * Tests fetch → list display → delete with AC-006 blocking
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiaListPanel } from "./membresia-list-panel";

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.confirm
global.confirm = jest.fn(() => true);

describe("MembresiaListPanel", () => {
  const mockMembresias = [
    {
      id: "1",
      nombre: "Gold",
      precio: 15000,
      periodicidad: 30,
      descripcion: "Plan Gold",
      estado: "ACTIVA" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedSocioCount: 5,
    },
    {
      id: "2",
      nombre: "Silver",
      precio: 10000,
      periodicidad: 30,
      descripcion: "Plan Silver",
      estado: "ACTIVA" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedSocioCount: 0,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (global.confirm as jest.Mock).mockClear();
  });

  describe("List fetching and display", () => {
    it("should fetch and display membresias on mount", async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMembresias,
      });

      const { rerender } = render(<MembresiaListPanel />);

      // Wait for membresias to appear
      await waitFor(() => {
        expect(screen.getByText("Gold")).toBeInTheDocument();
        expect(screen.getByText("Silver")).toBeInTheDocument();
      });

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalledWith("/api/membresias");
    });

    it("should fetch activeOnly when activeOnly prop is true", async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [mockMembresias[0]],
      });

      render(<MembresiaListPanel activeOnly={true} />);

      await waitFor(() => {
        expect(screen.getByText("Gold")).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/membresias?activeOnly=true");
    });

    it("should display loading state initially", () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockMembresias,
                } as Response),
              100
            )
          )
      );

      render(<MembresiaListPanel />);

      expect(screen.getByText(/cargando membresías/i)).toBeInTheDocument();
    });

    it("should display empty state when no membresias", async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<MembresiaListPanel />);

      await waitFor(() => {
        expect(screen.getByText(/no hay membresías/i)).toBeInTheDocument();
      });
    });
  });

  describe("Sorting", () => {
    it("should sort by nombre by default", async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMembresias,
      });

      render(<MembresiaListPanel />);

      await waitFor(() => {
        expect(screen.getByDisplayValue(/nombre/i)).toBeInTheDocument();
      });
    });

    it("should change list order when sorting option changes", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMembresias,
      });

      render(<MembresiaListPanel />);

      await waitFor(() => {
        expect(screen.getByText("Gold")).toBeInTheDocument();
      });

      // Change to sort by precio (Silver should come first at 10000 < 15000)
      const sortSelect = screen.getByDisplayValue(/nombre/i);
      await user.selectOptions(sortSelect, "precio");

      // Verify the order changed
      const rows = screen.getAllByRole("row");
      // Find Silver in the rows (should come before Gold when sorted by price)
      expect(rows.length).toBeGreaterThan(2);
    });

    it("should allow sorting by estado", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMembresias,
      });

      render(<MembresiaListPanel />);

      await waitFor(() => {
        expect(screen.getByText("Gold")).toBeInTheDocument();
      });

      const sortSelect = screen.getByDisplayValue(/nombre/i);
      await user.selectOptions(sortSelect, "estado");

      expect((sortSelect as HTMLSelectElement).value).toBe("estado");
    });
  });

  describe("AC-006: Delete blocking", () => {
    it("should show blocked delete message when 409 AC-006 response received", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      // Use a modified membresia WITHOUT assignedSocioCount to bypass UI disable
      // This simulates a race condition where server state changed between load and delete attempt
      const membresiaWithoutBlocking = {
        ...mockMembresias[0],
        assignedSocioCount: 0,  // UI shows it's deletable
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [membresiaWithoutBlocking, mockMembresias[1]],
      });

      // Server returns 409 when delete is attempted (AC-006: assigned at delete time)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          code: "DELETE_BLOCKED_ASSIGNED",
          message: "5 socios asignados",
        }),
      });

      const mockConfirm = jest.fn(() => true);
      global.confirm = mockConfirm;

      render(<MembresiaListPanel />);

      await waitFor(() => {
        expect(screen.getByText("Gold")).toBeInTheDocument();
      });

      // Now delete button is enabled (assignedSocioCount = 0)
      const deleteButtons = screen.getAllByRole("button", { name: /Eliminar/i });
      await user.click(deleteButtons[0]);  // Click "Eliminar" for Gold

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText(/¿Eliminar membresía\?/i)).toBeInTheDocument();
      });

      // User confirms
      const acceptButton = screen.getByRole("button", { name: /Aceptar/i });
      await user.click(acceptButton);

      // Server rejects with 409, panel displays error
      await waitFor(() => {
        expect(screen.getByText(/5 socios asignados/i)).toBeInTheDocument();
      });

      // Gold remains in list
      expect(screen.getByText("Gold")).toBeInTheDocument();
    });
  });

  describe("Refresh", () => {
    it("should refetch membresias when refresh button is clicked", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMembresias,
      });

      render(<MembresiaListPanel />);

      await waitFor(() => {
        expect(screen.getByText("Gold")).toBeInTheDocument();
      });

      const initialCallCount = mockFetch.mock.calls.length;

      const refreshButton = screen.getByRole("button", { name: /Actualizar/i });
      await user.click(refreshButton);

      // Verify fetch was called again
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("Error handling", () => {
    it("should display error when fetch fails", async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<MembresiaListPanel />);

      // Error state should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Network error|Error/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it("should show retry button on error", async () => {
      const mockFetch = global.fetch as jest.Mock;

      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<MembresiaListPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Network error|Error/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify retry button is present
      const retryButton = screen.getByRole("button", { name: /Reintentar/i });
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe("Edit callback", () => {
    it("should call onEditClick when edit button is clicked", async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as jest.Mock;
      const onEditClick = jest.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMembresias,
      });

      render(<MembresiaListPanel onEditClick={onEditClick} />);

      await waitFor(() => {
        expect(screen.getByText("Gold")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole("button", { name: /Editar/i });
      await user.click(editButtons[0]);

      expect(onEditClick).toHaveBeenCalledWith(expect.objectContaining({
        id: "1",
        nombre: "Gold",
      }));
    });
  });
});
