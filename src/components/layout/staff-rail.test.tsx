import React from "react";
import { render, screen } from "@testing-library/react";
import { StaffRail } from "./staff-rail";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
}));

const mockUseAuth = jest.fn();
jest.mock("@/contexts/auth", () => ({ useAuth: () => mockUseAuth() }));

const asRol = (rol: string, nombre = "Ana Pérez") => ({ user: { id: "u1", nombre, rol } });

describe("StaffRail (zonas por rol)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra la marca ARNOLD GYM", () => {
    mockUseAuth.mockReturnValue(asRol("ADMINISTRADOR"));
    render(<StaffRail activeSection="ejercicios" />);
    expect(screen.getByText("ARNOLD")).toBeInTheDocument();
    expect(screen.getByText("GYM")).toBeInTheDocument();
  });

  it("ADMINISTRADOR ve los 8 destinos con sus rutas", () => {
    mockUseAuth.mockReturnValue(asRol("ADMINISTRADOR"));
    render(<StaffRail activeSection="ejercicios" />);
    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Hoy" })).toHaveAttribute("href", "/home-interno");
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clientes");
    expect(screen.getByRole("link", { name: "Pagos" })).toHaveAttribute("href", "/pagos");
    expect(screen.getByRole("link", { name: "Cierres" })).toHaveAttribute("href", "/cierres");
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute("href", "/configuracion");
  });

  it("RECEPCIONISTA ve su trabajo real: Clientes, Pagos y Cierres", () => {
    mockUseAuth.mockReturnValue(asRol("RECEPCIONISTA"));
    render(<StaffRail activeSection="pagos" />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pagos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cierres" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Membresías" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
  });

  it("INSTRUCTOR ve Inicio + Rutinas y Ejercicios, y no ve zonas vacías", () => {
    mockUseAuth.mockReturnValue(asRol("INSTRUCTOR"));
    render(<StaffRail activeSection="rutinas" />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByText("Comercial")).not.toBeInTheDocument();
    expect(screen.getByText("Operación")).toBeInTheDocument();
  });

  it("marca la sección activa con aria-current=page", () => {
    mockUseAuth.mockReturnValue(asRol("ADMINISTRADOR"));
    render(<StaffRail activeSection="rutinas" />);
    expect(screen.getByRole("link", { name: "Rutinas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ejercicios" })).not.toHaveAttribute("aria-current");
  });

  it("sin usuario no muestra destinos", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<StaffRail activeSection="ejercicios" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
