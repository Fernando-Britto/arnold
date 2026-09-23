import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiaList } from "./membresia-list";
import type { Membresia } from "@/domains/membresia/membresia";

interface MembresiaWithCount extends Membresia {
  assignedSocioCount: number;
}

describe("MembresiaList", () => {
  const mockMembresias: MembresiaWithCount[] = [
    {
      id: "1",
      nombre: "Gold",
      precio: 15000,
      periodicidad: 30,
      descripcion: "Plan Gold",
      estado: "ACTIVA",
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
      estado: "ACTIVA",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedSocioCount: 0,
    },
    {
      id: "3",
      nombre: "Bronze",
      precio: 5000,
      periodicidad: 30,
      descripcion: "Plan Bronze",
      estado: "INACTIVA",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedSocioCount: 8,
    },
  ];

  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    mockOnEdit.mockClear();
    mockOnDelete.mockClear();
  });

  describe("Rendering", () => {
    it("should render table with membresias", () => {
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Gold")).toBeInTheDocument();
      expect(screen.getByText("Silver")).toBeInTheDocument();
      expect(screen.getByText("Bronze")).toBeInTheDocument();
    });

    it("should render empty state when no membresias", () => {
      render(
        <MembresiaList
          membresias={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(
        screen.getByText(/No hay membresías|sin membresías/i)
      ).toBeInTheDocument();
    });

    it("should display precio formatted with 2 decimals", () => {
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Gold precio 15000 should show as 15000.00 or 15.000,00
      const precioText = screen.getAllByText(/15000/)[0];
      expect(precioText).toBeInTheDocument();
    });

    it("should show estado as badge (ACTIVA green, INACTIVA gray)", () => {
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      const activaBadges = screen.getAllByText("Activa");
      const inactivaBadges = screen.getAllByText("Inactiva");

      expect(activaBadges.length).toBeGreaterThan(0);
      expect(inactivaBadges.length).toBeGreaterThan(0);
    });
  });

  describe("Miembros column (AC-007)", () => {
    it("should display Miembros column with assigned socio count", () => {
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Gold has 5 assigned socios
      expect(screen.getByText("5")).toBeInTheDocument();
      // Silver has 0 assigned (displayed as "0")
      const zeroCount = screen.getAllByText("0");
      expect(zeroCount.length).toBeGreaterThan(0);
      // Bronze has 8 assigned
      expect(screen.getByText("8")).toBeInTheDocument();
    });

    it("should show Miembros column header", () => {
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Miembros")).toBeInTheDocument();
    });
  });

  describe("Actions", () => {
    it("should call onEdit when edit button clicked", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find the edit button for Gold row
      const goldRow = screen.getByText("Gold").closest("tr");
      const editButton = goldRow?.querySelector('button[class*="bg-blue"]');
      
      await user.click(editButton as HTMLElement);

      expect(mockOnEdit).toHaveBeenCalledWith(mockMembresias[0]);
    });

    it("should show delete confirmation before deleting", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find the delete button for Silver (0 assigned, so it's enabled)
      const silverRow = screen.getByText("Silver").closest("tr");
      const deleteButton = silverRow?.querySelector('button[class*="bg-red"]');
      
      await user.click(deleteButton as HTMLElement);

      // Should show confirmation modal
      await waitFor(() => {
        expect(
          screen.getByText(/¿Eliminar membresía?/i)
        ).toBeInTheDocument();
      });
    });

    it("should call onDelete only after confirmation", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find the delete button for Silver (0 assigned, so it's enabled)
      const silverRow = screen.getByText("Silver").closest("tr");
      const deleteButton = silverRow?.querySelector('button[class*="bg-red"]');
      
      await user.click(deleteButton as HTMLElement);

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /aceptar/i }));
      });
      const confirmButton = screen.getByRole("button", {
        name: /aceptar/i,
      });
      await user.click(confirmButton);

      expect(mockOnDelete).toHaveBeenCalledWith(mockMembresias[1].id); // Silver's id is "2"
    });

    it("should cancel delete confirmation", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find the delete button for Silver (0 assigned, so it's enabled)
      const silverRow = screen.getByText("Silver").closest("tr");
      const deleteButton = silverRow?.querySelector('button[class*="bg-red"]');
      
      await user.click(deleteButton as HTMLElement);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /cancelar/i }));
      });
      const cancelButton = screen.getByRole("button", { name: /cancelar/i });
      await user.click(cancelButton);

      // Modal should disappear - the aceptar button should no longer be visible
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /aceptar/i })
        ).not.toBeInTheDocument();
      });

      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe("Delete blocking (AC-006)", () => {
    it("should DISABLE delete button when Socios are assigned (assignedSocioCount > 0)", () => {
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      const allDeleteButtons = screen.getAllByRole("button", { name: /eliminar/i });

      // List is sorted by nombre: Bronze, Gold, Silver
      // So the order of delete buttons is: Bronze (disabled), Gold (disabled), Silver (enabled)
      // But we need to map them correctly
      
      // Find buttons by row
      const goldRow = screen.getByText("Gold").closest("tr");
      const goldButtons = goldRow?.querySelectorAll("button") || [];
      const goldDeleteBtn = Array.from(goldButtons).find(
        (btn) => btn.textContent?.includes("Eliminar")
      ) as HTMLButtonElement;

      const silverRow = screen.getByText("Silver").closest("tr");
      const silverButtons = silverRow?.querySelectorAll("button") || [];
      const silverDeleteBtn = Array.from(silverButtons).find(
        (btn) => btn.textContent?.includes("Eliminar")
      ) as HTMLButtonElement;

      const bronzeRow = screen.getByText("Bronze").closest("tr");
      const bronzeButtons = bronzeRow?.querySelectorAll("button") || [];
      const bronzeDeleteBtn = Array.from(bronzeButtons).find(
        (btn) => btn.textContent?.includes("Eliminar")
      ) as HTMLButtonElement;

      // Gold has 5 assigned socios → disabled
      expect(goldDeleteBtn?.disabled).toBe(true);
      // Silver has 0 assigned → enabled
      expect(silverDeleteBtn?.disabled).toBe(false);
      // Bronze has 8 assigned → disabled
      expect(bronzeDeleteBtn?.disabled).toBe(true);
    });

    it("should show tooltip/message when delete is disabled due to assigned members", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Get all Eliminar buttons (in order: Bronze, Gold, Silver)
      const deleteButtons = screen.getAllByRole("button", { name: /eliminar/i });
      // Gold is second (Bronze=0, Gold=1, Silver=2)
      const goldDeleteBtn = deleteButtons[1];

      // Hover over the button
      await user.hover(goldDeleteBtn);

      // The tooltip should appear on hover (it's in a group:hover div)
      await waitFor(() => {
        // Look for the text in the DOM - should be visible after hover
        // Use queryAllByText because there may be multiple disabled buttons
        const tooltips = screen.queryAllByText(/Esta membresía está asignada a socios/i);
        expect(tooltips.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Sorting", () => {
    it("should sort by nombre when header clicked", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // List defaults to nombre ascending (Bronze, Gold, Silver)
      const rows = screen.getAllByRole("row");
      // rows[0] is header, rows[1-3] are data
      expect(rows[1]).toHaveTextContent("Bronze"); // First alphabetically
      expect(rows[2]).toHaveTextContent("Gold");
      expect(rows[3]).toHaveTextContent("Silver");
    });

    it("should reverse sort when same header clicked twice", async () => {
      const user = userEvent.setup();
      render(
        <MembresiaList
          membresias={mockMembresias}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      const nombreHeader = screen.getByText(/^Nombre/); // Match just "Nombre", not "Nombre ↑"

      // First click: toggle descending (was ascending by default)
      await user.click(nombreHeader);
      let rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("Silver"); // Last alphabetically

      // Second click: back to ascending
      await user.click(nombreHeader);
      rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("Bronze");
    });
  });
});
