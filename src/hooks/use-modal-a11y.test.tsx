import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useModalA11y } from "./use-modal-a11y";

/**
 * Minimal harness that exercises the hook the same way the real modals do:
 * a trigger button, and (while open) a dialog with several focusable controls.
 */
function Demo({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClose();
  };
  const ref = useModalA11y(open, close);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir modal
      </button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="Demo">
          <button type="button">Uno</button>
          <button type="button">Dos</button>
          <button type="button" onClick={close}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

describe("useModalA11y", () => {
  it("mueve el foco inicial al primer control del modal", async () => {
    const user = userEvent.setup();
    render(<Demo onClose={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: /abrir modal/i }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Uno" }));
  });

  it("Tab cicla dentro del modal: desde el último control vuelve al primero", async () => {
    const user = userEvent.setup();
    render(<Demo onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /abrir modal/i }));

    await user.tab(); // Uno -> Dos
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Dos" }));

    await user.tab(); // Dos -> Cerrar
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar" }));

    await user.tab(); // Cerrar -> Uno (trap)
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Uno" }));
  });

  it("Shift+Tab desde el primer control va al último (trap)", async () => {
    const user = userEvent.setup();
    render(<Demo onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /abrir modal/i }));

    await user.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar" }));
  });

  it("Escape cierra el modal", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<Demo onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /abrir modal/i }));

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("devuelve el foco al trigger al cerrar", async () => {
    const user = userEvent.setup();
    render(<Demo onClose={jest.fn()} />);
    const trigger = screen.getByRole("button", { name: /abrir modal/i });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(document.activeElement).toBe(trigger);
  });
});
