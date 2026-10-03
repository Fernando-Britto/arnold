import React from "react";
import { render, screen } from "@testing-library/react";
import { AdminTopNav } from "./admin-top-nav";

const mockUseAuth = jest.fn();
jest.mock("@/contexts/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const userWithRole = (rol: string, nombre = "Ana Pérez") => ({
  user: { id: "u1", nombre, rol },
});

describe("AdminTopNav", () => {
  it("muestra el logo ARNOLD GYM", () => {
    mockUseAuth.mockReturnValue(userWithRole("ADMINISTRADOR"));
    render(<AdminTopNav activeSection="ejercicios" />);
    expect(screen.getByText("ARNOLD")).toBeInTheDocument();
    expect(screen.getByText("GYM")).toBeInTheDocument();
  });

  it("sin activeSection (ej. Home_Interno) no marca ningún link como activo", () => {
    mockUseAuth.mockReturnValue(userWithRole("ADMINISTRADOR"));
    render(<AdminTopNav />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    screen.getAllByRole("link").forEach((link) => expect(link).not.toHaveAttribute("aria-current"));
  });

  it("ADMINISTRADOR ve los 4 links con sus rutas", () => {
    mockUseAuth.mockReturnValue(userWithRole("ADMINISTRADOR"));
    render(<AdminTopNav activeSection="ejercicios" />);
    expect(screen.getByRole("link", { name: "Membresías" })).toHaveAttribute("href", "/membresias");
    expect(screen.getByRole("link", { name: "Rutinas" })).toHaveAttribute("href", "/rutinas");
    expect(screen.getByRole("link", { name: "Ejercicios" })).toHaveAttribute("href", "/ejercicios");
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clientes");
  });

  it("INSTRUCTOR solo ve Rutinas y Ejercicios", () => {
    mockUseAuth.mockReturnValue(userWithRole("INSTRUCTOR"));
    render(<AdminTopNav activeSection="rutinas" />);
    expect(screen.getByRole("link", { name: "Rutinas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ejercicios" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Membresías" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clientes" })).not.toBeInTheDocument();
  });

  it("RECEPCIONISTA solo ve Clientes", () => {
    mockUseAuth.mockReturnValue(userWithRole("RECEPCIONISTA"));
    render(<AdminTopNav activeSection="clientes" />);
    expect(screen.getByRole("link", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Rutinas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ejercicios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Membresías" })).not.toBeInTheDocument();
  });

  it("marca la sección activa con aria-current=page y las demás no", () => {
    mockUseAuth.mockReturnValue(userWithRole("ADMINISTRADOR"));
    render(<AdminTopNav activeSection="rutinas" />);
    expect(screen.getByRole("link", { name: "Rutinas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ejercicios" })).not.toHaveAttribute("aria-current");
  });

  it("muestra la inicial del usuario en el avatar", () => {
    mockUseAuth.mockReturnValue(userWithRole("ADMINISTRADOR", "Ana Pérez"));
    render(<AdminTopNav activeSection="ejercicios" />);
    expect(screen.getByLabelText("Usuario: Ana Pérez")).toHaveTextContent("A");
  });

  it("sin usuario no muestra links de navegación", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<AdminTopNav activeSection="ejercicios" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("usuario sin nombre no rompe el render (no muestra avatar)", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1", rol: "ADMINISTRADOR" } });
    render(<AdminTopNav activeSection="ejercicios" />);
    expect(screen.getByText("ARNOLD")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Usuario:/)).not.toBeInTheDocument();
  });
});
