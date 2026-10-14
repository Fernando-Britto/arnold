import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopNav, topNavHref } from "./top-nav";

describe("TopNav (matches Home_Socio_1x §TopNav)", () => {
  it("renders the two-tone logo", () => {
    render(<TopNav active="inicio" />);
    expect(screen.getByText("ARNOLD")).toBeInTheDocument();
    expect(screen.getByText("GYM")).toBeInTheDocument();
  });

  it("renders the nav links for every socio section (T-039)", () => {
    render(<TopNav active="inicio" />);
    ["Inicio", "Mi rutina", "Mis ejercicios", "Mi progreso", "Mi membresía", "Mis asistencias"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it("maps each link to its real route", () => {
    expect(topNavHref("inicio")).toBe("/home-socio");
    expect(topNavHref("rutina")).toBe("/home-socio/mi-rutina");
    expect(topNavHref("ejercicios")).toBe("/home-socio/mis-ejercicios");
    expect(topNavHref("progreso")).toBe("/home-socio/progreso");
    expect(topNavHref("membresia")).toBe("/home-socio/mi-membresia");
    expect(topNavHref("asistencias")).toBe("/home-socio/mis-asistencias");
  });

  it("calls onNavigate with the clicked link", async () => {
    const onNavigate = jest.fn();
    const user = userEvent.setup();
    render(<TopNav active="inicio" onNavigate={onNavigate} />);
    await user.click(screen.getByTestId("nav-link-rutina"));
    expect(onNavigate).toHaveBeenCalledWith("rutina");
  });

  it("marks only the active link, driven by the `active` prop (not hardcoded to Inicio)", () => {
    render(<TopNav active="progreso" />);
    expect(screen.getByTestId("nav-link-progreso")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("nav-link-inicio")).toHaveAttribute("data-active", "false");
  });

  it("Buscar y Perfil no son interactivos: no hay destino todavía (mismo criterio que Notificaciones)", () => {
    render(<TopNav active="inicio" />);

    const buscar = screen.getByRole("button", { name: /buscar/i });
    const perfil = screen.getByRole("button", { name: /perfil/i });

    expect(buscar).toBeDisabled();
    expect(perfil).toBeDisabled();
    expect(buscar.getAttribute("title")).toMatch(/disponible/i);
    expect(perfil.getAttribute("title")).toMatch(/disponible/i);
  });

  it("la campana de notificaciones no es interactiva: no hay feature todavía (HI-1)", () => {
    render(<TopNav active="inicio" />);
    const bell = screen.getByLabelText("Notificaciones");
    expect(bell).toBeDisabled();
    expect(bell.getAttribute("title")).toMatch(/disponible/i);
  });

  it("tiene un botón 'Cerrar sesión' que llama a onLogoutClick (el Socio no tenía forma de salir)", async () => {
    const onLogoutClick = jest.fn();
    const user = userEvent.setup();
    render(<TopNav active="inicio" onLogoutClick={onLogoutClick} />);

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(onLogoutClick).toHaveBeenCalledTimes(1);
  });
});
