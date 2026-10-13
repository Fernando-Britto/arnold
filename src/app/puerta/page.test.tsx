/**
 * Página /puerta (T-036): se usa SIN sesión de usuario. Sin token configurado ofrece el alta
 * del dispositivo; con token monta el kiosco de puerta.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PuertaPage } from "./page";

jest.mock("@/components/acceso/kiosco-puerta", () => ({
  KioscoPuerta: ({ token }: { token: string }) => <div>Kiosco de puerta {token}</div>,
}));

describe("PuertaPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("sin token configurado muestra el alta del dispositivo", async () => {
    render(<PuertaPage />);
    expect(await screen.findByText(/configurar dispositivo/i)).toBeInTheDocument();
    expect(screen.queryByText(/kiosco de puerta/i)).not.toBeInTheDocument();
  });

  it("con token guardado monta el kiosco de puerta", async () => {
    localStorage.setItem("dispositivoToken", "tok-dev");
    render(<PuertaPage />);
    expect(await screen.findByText(/kiosco de puerta/i)).toBeInTheDocument();
  });

  it("guarda el token ingresado y monta el kiosco", async () => {
    const user = userEvent.setup();
    render(<PuertaPage />);

    await user.type(await screen.findByLabelText(/token del dispositivo/i), "tok-nuevo");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/kiosco de puerta/i)).toBeInTheDocument();
    expect(localStorage.getItem("dispositivoToken")).toBe("tok-nuevo");
  });
});
