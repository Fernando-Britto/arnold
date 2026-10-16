import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

const baseProps = {
  open: true,
  title: "Eliminar ejercicio",
  message: "¿Está seguro que desea eliminar \"Press Militar\"?",
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe("ConfirmDialog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("cerrado no renderiza nada", () => {
    render(<ConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza título, mensaje y las etiquetas por defecto", () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Eliminar ejercicio")).toBeInTheDocument();
    expect(screen.getByText(/desea eliminar "Press Militar"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("permite etiquetas personalizadas", () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Eliminar" cancelLabel="Volver" />);
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("confirmar y cancelar disparan sus callbacks", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...baseProps} confirmLabel="Eliminar" />);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape cancela", () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("con confirmando deshabilita ambos botones y evita el doble envío", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog {...baseProps} confirmLabel="Eliminar" confirmando />);
    const confirmar = screen.getByRole("button", { name: "Eliminar" });
    expect(confirmar).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await user.click(confirmar);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });

  it("confirmDisabled bloquea solo el botón de confirmar", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        {...baseProps}
        confirmLabel="Eliminar"
        confirmDisabled
        message="Este ejercicio está en 2 rutinas; no se puede eliminar."
      />
    );
    const confirmar = screen.getByRole("button", { name: "Eliminar" });
    expect(confirmar).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();

    await user.click(confirmar);
    expect(baseProps.onConfirm).not.toHaveBeenCalled();
  });
});
