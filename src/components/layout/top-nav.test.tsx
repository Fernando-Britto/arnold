import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopNav } from "./top-nav";

describe("TopNav (matches Home_Socio_1x §TopNav)", () => {
  it("renders the two-tone logo", () => {
    render(<TopNav active="inicio" />);
    expect(screen.getByText("ARNOLD")).toBeInTheDocument();
    expect(screen.getByText("GYM")).toBeInTheDocument();
  });

  it("renders the 4 nav links", () => {
    render(<TopNav active="inicio" />);
    ["Inicio", "Mi rutina", "Mi membresía", "Mi progreso"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it("marks only the active link, driven by the `active` prop (not hardcoded to Inicio)", () => {
    render(<TopNav active="progreso" />);
    expect(screen.getByTestId("nav-link-progreso")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("nav-link-inicio")).toHaveAttribute("data-active", "false");
  });

  it("calls onSearchClick / onNotificationsClick / onAvatarClick", async () => {
    const onSearchClick = jest.fn();
    const onNotificationsClick = jest.fn();
    const onAvatarClick = jest.fn();
    const user = userEvent.setup();
    render(
      <TopNav
        active="inicio"
        onSearchClick={onSearchClick}
        onNotificationsClick={onNotificationsClick}
        onAvatarClick={onAvatarClick}
      />
    );
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await user.click(screen.getByRole("button", { name: /notificaciones/i }));
    await user.click(screen.getByRole("button", { name: /perfil/i }));
    expect(onSearchClick).toHaveBeenCalledTimes(1);
    expect(onNotificationsClick).toHaveBeenCalledTimes(1);
    expect(onAvatarClick).toHaveBeenCalledTimes(1);
  });

  it("tiene un botón 'Cerrar sesión' que llama a onLogoutClick (el Socio no tenía forma de salir)", async () => {
    const onLogoutClick = jest.fn();
    const user = userEvent.setup();
    render(<TopNav active="inicio" onLogoutClick={onLogoutClick} />);

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(onLogoutClick).toHaveBeenCalledTimes(1);
  });
});
