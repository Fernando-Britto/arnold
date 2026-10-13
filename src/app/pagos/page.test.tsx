/**
 * Página /pagos (T-033): guarda de sesión y de rol (ADMINISTRADOR / RECEPCIONISTA).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { PagosPage } from "./page";
import { useAuth } from "@/contexts/auth";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/pagos",
}));
jest.mock("@/contexts/auth");
jest.mock("@/components/pago/pago-form", () => ({
  PagoForm: () => <div>Formulario de pago</div>,
}));

const mockAuth = useAuth as jest.Mock;

describe("PagosPage — guardas de acceso", () => {
  beforeEach(() => jest.clearAllMocks());

  it("redirige a /login sin sesión", async () => {
    mockAuth.mockReturnValue({ user: null, isAuthenticated: false });

    render(<PagosPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Formulario de pago")).not.toBeInTheDocument();
  });

  it("redirige a /home-socio a un rol no autorizado (INSTRUCTOR)", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "INSTRUCTOR" }, isAuthenticated: true });

    render(<PagosPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
  });

  it("renderiza el formulario para RECEPCIONISTA sin redirigir", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "RECEPCIONISTA" }, isAuthenticated: true });

    render(<PagosPage />);

    expect(await screen.findByText("Formulario de pago")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("renderiza el formulario para ADMINISTRADOR sin redirigir", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "ADMINISTRADOR" }, isAuthenticated: true });

    render(<PagosPage />);

    expect(await screen.findByText("Formulario de pago")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("renderiza el chrome compartido (TopNav + ActionBar)", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "ADMINISTRADOR" }, isAuthenticated: true });

    render(<PagosPage />);

    expect(await screen.findByText("Formulario de pago")).toBeInTheDocument();
    expect(screen.getByLabelText("Navegación principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
  });
});
