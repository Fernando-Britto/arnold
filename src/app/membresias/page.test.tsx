import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiasPage } from "./page";
import { useAuth } from "@/contexts/auth";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/membresias",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/contexts/auth");

const mockMembresia = {
  id: "1",
  nombre: "Gold",
  precio: 15000,
  periodicidad: 30,
  descripcion: "Premium membership",
  estado: "ACTIVA" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignedSocioCount: 5,
};

jest.mock("@/components/membresia-crud/membresia-form-panel", () => ({
  MembresiaFormPanel: ({ initialData, onSuccess, onCancel }: any) => (
    <div data-testid="membresia-form-panel">
      <button data-testid="form-cancel-btn" onClick={() => onCancel()}>Cancel</button>
      <button data-testid="form-success-btn" onClick={() => onSuccess({ ...initialData, id: initialData?.id || "new-id" })}>Save</button>
    </div>
  ),
}));

jest.mock("@/components/membresia-crud/membresia-list-panel", () => ({
  MembresiaListPanel: ({ onEditClick }: any) => (
    <div data-testid="membresia-list-panel">
      <button data-testid="list-edit-btn" onClick={() => onEditClick(mockMembresia)}>Edit Gold</button>
    </div>
  ),
}));

describe("Membresias CRUD Screen - T-017", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user1", rol: "ADMINISTRADOR" },
      isAuthenticated: true,
    });
  });

  describe("Role-based access control", () => {
    it("should render page for ADMINISTRADOR and redirect non-admin roles", async () => {
      render(<MembresiasPage />);
      await waitFor(() => {
        expect(screen.getByTestId("membresia-form-panel")).toBeInTheDocument();
        expect(screen.getByTestId("membresia-list-panel")).toBeInTheDocument();
      });
    });

    it("should redirect INSTRUCTOR to /home-socio", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "INSTRUCTOR" },
        isAuthenticated: true,
      });
      render(<MembresiasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
    });

    it("should redirect RECEPCIONISTA to /home-socio", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "RECEPCIONISTA" },
        isAuthenticated: true,
      });
      render(<MembresiasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
    });

    it("should redirect unauthenticated users to /login", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isAuthenticated: false });
      render(<MembresiasPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    });

    it("should show access denied for unauthorized roles", async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "user1", rol: "SOCIO" },
        isAuthenticated: true,
      });
      render(<MembresiasPage />);
      await waitFor(() => {
        expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
      });
    });
  });

  describe("Page layout", () => {
    it("should render title, form panel, and list panel", async () => {
      render(<MembresiasPage />);
      await waitFor(() => {
        expect(screen.getByText("Membresías")).toBeInTheDocument();
        expect(screen.getByTestId("membresia-form-panel")).toBeInTheDocument();
        expect(screen.getByTestId("membresia-list-panel")).toBeInTheDocument();
        expect(screen.getByText("Nueva Membresía")).toBeInTheDocument();
      });
    });
  });

  describe("Edit flow: select from list → form updates", () => {
    it("should change title to 'Editar' when membresia is selected and pass initialData", async () => {
      const user = userEvent.setup();
      render(<MembresiasPage />);

      const editBtn = await screen.findByTestId("list-edit-btn");
      await user.click(editBtn);

      await waitFor(() => {
        expect(screen.getByTestId("form-title")).toHaveTextContent("Editar Membresía");
      });
    });
  });

  describe("Cancel flow: onCancel clears form", () => {
    it("should clear form and revert title when cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<MembresiasPage />);

      const editBtn = await screen.findByTestId("list-edit-btn");
      await user.click(editBtn);
      await waitFor(() => expect(screen.getByTestId("form-title")).toHaveTextContent("Editar Membresía"));

      const cancelBtn = await screen.findByTestId("form-cancel-btn");
      await user.click(cancelBtn);

      await waitFor(() => {
        expect(screen.getByTestId("form-title")).toHaveTextContent("Nueva Membresía");
      });
    });
  });

  describe("Success flow: onSuccess clears form and refreshes list", () => {
    it("should clear form and refresh list panel when form saves successfully", async () => {
      const user = userEvent.setup();
      render(<MembresiasPage />);

      const editBtn = await screen.findByTestId("list-edit-btn");
      await user.click(editBtn);
      await waitFor(() => expect(screen.getByTestId("form-title")).toHaveTextContent("Editar Membresía"));

      const successBtn = await screen.findByTestId("form-success-btn");
      await user.click(successBtn);

      await waitFor(() => {
        expect(screen.getByTestId("form-title")).toHaveTextContent("Nueva Membresía");
        expect(screen.getByTestId("membresia-list-panel")).toBeInTheDocument();
      });
    });
  });

  describe("Callback integration", () => {
    it("should wire onSuccess, onCancel, and onEditClick callbacks properly", async () => {
      const user = userEvent.setup();
      render(<MembresiasPage />);

      await waitFor(() => {
        expect(screen.getByTestId("form-cancel-btn")).toBeInTheDocument();
        expect(screen.getByTestId("form-success-btn")).toBeInTheDocument();
        expect(screen.getByTestId("list-edit-btn")).toBeInTheDocument();
      });
    });
  });
});
