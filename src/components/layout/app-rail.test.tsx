import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import { AppRail, RailFooter, type RailZone } from "./app-rail";

const seleccionar = { onSelect: jest.fn() };

const zones: RailZone[] = [
  {
    items: [
      { key: "hoy", label: "Hoy", href: "/home-interno", active: true, icon: Users, ...seleccionar },
    ],
  },
  {
    label: "Socios",
    items: [
      { key: "clientes", label: "Clientes", href: "/clientes", active: false, icon: Users, ...seleccionar },
    ],
  },
];

const footer = <RailFooter nombre="Admin Arnold" rol="Administrador" />;

describe("AppRail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete document.documentElement.dataset.rail;
    document.cookie = "rail=; path=/; max-age=0";
  });

  it("renderiza marca, zonas y destinos", () => {
    render(<AppRail navLabel="Principal" zones={zones} footer={footer} />);
    expect(screen.getByText("ARNOLD")).toBeInTheDocument();
    expect(screen.getByText("GYM")).toBeInTheDocument();
    expect(screen.getByText("Socios")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clientes");
  });

  it("marca el destino activo con aria-current y data-active", () => {
    render(<AppRail navLabel="Principal" zones={zones} footer={footer} />);
    expect(screen.getByTestId("nav-link-hoy")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-link-hoy")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("nav-link-clientes")).toHaveAttribute("data-active", "false");
  });

  it("el avatar del pie muestra las dos iniciales del nombre", () => {
    render(<AppRail navLabel="Principal" zones={zones} footer={footer} />);
    expect(screen.getByText("AA")).toBeInTheDocument();
  });

  it("el botón contrae el rail, deja la preferencia en la cookie y vuelve a expandirlo", async () => {
    render(<AppRail navLabel="Principal" zones={zones} footer={footer} />);
    const boton = screen.getByRole("button", { name: "Contraer barra lateral" });

    await userEvent.click(boton);
    expect(document.documentElement.dataset.rail).toBe("colapsado");
    expect(document.cookie).toContain("rail=colapsado");

    await userEvent.click(boton);
    expect(document.documentElement.dataset.rail).toBe("expandido");
  });
});
