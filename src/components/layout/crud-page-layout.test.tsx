import React from "react";
import { render, screen } from "@testing-library/react";
import { CrudPageLayout, FormPanelShell, ListPanelShell } from "./crud-page-layout";

jest.mock("@/contexts/auth", () => ({
  useAuth: () => ({ user: { id: "u1", nombre: "Ana", rol: "ADMINISTRADOR" } }),
}));

describe("CrudPageLayout", () => {
  const base = {
    section: "ejercicios" as const,
    breadcrumb: "Ejercicios",
    formPanel: <div>FORM</div>,
    listPanel: <div>LISTA</div>,
  };

  it("compone TopNav, ActionBar, formPanel y listPanel", () => {
    render(<CrudPageLayout {...base} />);
    expect(screen.getByText("ARNOLD")).toBeInTheDocument();
    expect(screen.getByText("Gestión")).toBeInTheDocument();
    expect(screen.getByText("FORM")).toBeInTheDocument();
    expect(screen.getByText("LISTA")).toBeInTheDocument();
  });

  it("renderiza las acciones en la ActionBar", () => {
    render(<CrudPageLayout {...base} actions={<button>Accion X</button>} />);
    expect(screen.getByRole("button", { name: "Accion X" })).toBeInTheDocument();
  });

  it("muestra el error como alert cuando existe", () => {
    render(<CrudPageLayout {...base} error="Algo salió mal" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
  });

  it("no muestra alert sin error", () => {
    render(<CrudPageLayout {...base} error={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("FormPanelShell", () => {
  it("muestra título, contenido y la línea de acento naranja", () => {
    const { container } = render(
      <FormPanelShell title="Nuevo Ejercicio">
        <p>contenido</p>
      </FormPanelShell>
    );
    expect(screen.getByRole("heading", { name: "Nuevo Ejercicio" })).toBeInTheDocument();
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(container.querySelector('[data-testid="accent-line"]')).toHaveClass("bg-[#FC4C02]");
  });

  it("acepta un titleTestId opcional para el título (compat con tests existentes)", () => {
    render(
      <FormPanelShell title="Nueva Membresía" titleTestId="form-title">
        <p>contenido</p>
      </FormPanelShell>
    );
    expect(screen.getByTestId("form-title")).toHaveTextContent("Nueva Membresía");
  });
});

describe("ListPanelShell", () => {
  it("renderiza sus children", () => {
    render(
      <ListPanelShell>
        <p>tabla</p>
      </ListPanelShell>
    );
    expect(screen.getByText("tabla")).toBeInTheDocument();
  });
});
