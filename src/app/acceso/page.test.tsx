/**
 * Página /acceso (T-035): guarda de sesión y de rol (ADMINISTRADOR / RECEPCIONISTA).
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AccesoPage } from "./page";
import { useAuth } from "@/contexts/auth";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/acceso",
}));
jest.mock("@/contexts/auth");
jest.mock("@/components/acceso/kiosco-acceso", () => ({
  KioscoAcceso: () => <div>Kiosco de acceso</div>,
}));

const mockAuth = useAuth as jest.Mock;

describe("AccesoPage — guardas de acceso", () => {
  beforeEach(() => jest.clearAllMocks());

  it("redirige a /login sin sesión", async () => {
    mockAuth.mockReturnValue({ user: null, isAuthenticated: false });

    render(<AccesoPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Kiosco de acceso")).not.toBeInTheDocument();
  });

  it("redirige a /home-socio a un rol no autorizado (INSTRUCTOR)", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "INSTRUCTOR" }, isAuthenticated: true });

    render(<AccesoPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/home-socio"));
  });

  it("renderiza el kiosco para RECEPCIONISTA sin redirigir", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "RECEPCIONISTA" }, isAuthenticated: true });

    render(<AccesoPage />);

    expect(await screen.findByText("Kiosco de acceso")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("renderiza el kiosco para ADMINISTRADOR sin redirigir", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "ADMINISTRADOR" }, isAuthenticated: true });

    render(<AccesoPage />);

    expect(await screen.findByText("Kiosco de acceso")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
