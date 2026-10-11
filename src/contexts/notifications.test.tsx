import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationProvider, useNotifications } from "./notifications";

function Harness() {
  const { notify } = useNotifications();
  return (
    <>
      <button onClick={() => notify("success", "Guardado")}>ok</button>
      <button onClick={() => notify("error", "Falló")}>mal</button>
    </>
  );
}

describe("NotificationProvider", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("useNotifications fuera del provider lanza un error claro", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow("useNotifications must be used within NotificationProvider");
    spy.mockRestore();
  });

  it("muestra el mensaje y lo anuncia: role=status para éxito, role=alert para error", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<NotificationProvider><Harness /></NotificationProvider>);

    await user.click(screen.getByText("ok"));
    expect(screen.getByRole("status")).toHaveTextContent("Guardado");

    await user.click(screen.getByText("mal"));
    expect(screen.getByRole("alert")).toHaveTextContent("Falló");
  });

  it("se cierra solo pasado el tiempo", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<NotificationProvider autoDismissMs={3000}><Harness /></NotificationProvider>);

    await user.click(screen.getByText("ok"));
    expect(screen.getByText("Guardado")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Guardado")).not.toBeInTheDocument();
  });

  it("se puede cerrar a mano", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<NotificationProvider><Harness /></NotificationProvider>);

    await user.click(screen.getByText("mal"));
    await user.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.queryByText("Falló")).not.toBeInTheDocument();
  });

  it("apila varias notificaciones", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<NotificationProvider><Harness /></NotificationProvider>);

    await user.click(screen.getByText("ok"));
    await user.click(screen.getByText("mal"));
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    expect(screen.getByText("Falló")).toBeInTheDocument();
  });
});
