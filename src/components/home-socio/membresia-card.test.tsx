import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembresiaCard } from "./membresia-card";

describe("MembresiaCard (matches Home_Socio_1x §Fila3 Membresia)", () => {
  const hoy = new Date("2026-09-24T12:00:00Z");
  const dias28 = new Array(28).fill(false).map((_, i) => i % 3 === 0);

  it('shows the plan name, "Al día" badge, and formatted vencimiento date', () => {
    render(
      <MembresiaCard
        planNombre="Plan Musculación"
        fechaVencimiento={new Date("2026-10-15T00:00:00Z")}
        diasTotalMembresia={30}
        hoy={hoy}
        dias28={dias28}
        totalAsistencias={12}
      />
    );
    expect(screen.getByText("Plan Musculación")).toBeInTheDocument();
    expect(screen.getByText("Al día")).toBeInTheDocument();
    expect(screen.getByText(/vencimiento: 15 de octubre, 2026/i)).toBeInTheDocument();
  });

  it('shows "Quedan N de M días"', () => {
    render(
      <MembresiaCard
        planNombre="Plan Musculación"
        fechaVencimiento={new Date("2026-10-15T00:00:00Z")}
        diasTotalMembresia={30}
        hoy={hoy}
        dias28={dias28}
        totalAsistencias={12}
      />
    );
    expect(screen.getByText("Quedan 21 de 30 días")).toBeInTheDocument();
  });

  it('always shows "Ver membresía"', () => {
    render(
      <MembresiaCard
        planNombre="Plan Musculación"
        fechaVencimiento={new Date("2026-10-15T00:00:00Z")}
        diasTotalMembresia={30}
        hoy={hoy}
        dias28={dias28}
        totalAsistencias={12}
      />
    );
    expect(screen.getByRole("button", { name: /ver membresía/i })).toBeInTheDocument();
  });

  it('adds "Renovar ahora" only when the membership is expiring/expired (AC-007)', () => {
    const { rerender } = render(
      <MembresiaCard
        planNombre="Plan Musculación"
        fechaVencimiento={new Date("2026-10-15T00:00:00Z")}
        diasTotalMembresia={30}
        hoy={hoy}
        dias28={dias28}
        totalAsistencias={12}
      />
    );
    expect(screen.queryByRole("button", { name: /renovar ahora/i })).not.toBeInTheDocument();

    rerender(
      <MembresiaCard
        planNombre="Plan Musculación"
        fechaVencimiento={new Date("2026-09-26T00:00:00Z")}
        diasTotalMembresia={30}
        hoy={hoy}
        dias28={dias28}
        totalAsistencias={12}
      />
    );
    expect(screen.getByRole("button", { name: /renovar ahora/i })).toBeInTheDocument();
  });

  it('renders the "Últimas 4 semanas" widget with the total and a 28-dot grid', () => {
    render(
      <MembresiaCard
        planNombre="Plan Musculación"
        fechaVencimiento={new Date("2026-10-15T00:00:00Z")}
        diasTotalMembresia={30}
        hoy={hoy}
        dias28={dias28}
        totalAsistencias={12}
      />
    );
    expect(screen.getByText("Últimas 4 semanas")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Asistencias totales")).toBeInTheDocument();
    expect(screen.getAllByTestId("dia-dot")).toHaveLength(28);
  });

  it("calls onVerMembresia and onRenovar when clicked", async () => {
    const onVerMembresia = jest.fn();
    const onRenovar = jest.fn();
    const user = userEvent.setup();
    render(
      <MembresiaCard
        planNombre="Plan Musculación"
        fechaVencimiento={new Date("2026-09-26T00:00:00Z")}
        diasTotalMembresia={30}
        hoy={hoy}
        dias28={dias28}
        totalAsistencias={12}
        onVerMembresia={onVerMembresia}
        onRenovar={onRenovar}
      />
    );
    await user.click(screen.getByRole("button", { name: /ver membresía/i }));
    await user.click(screen.getByRole("button", { name: /renovar ahora/i }));
    expect(onVerMembresia).toHaveBeenCalledTimes(1);
    expect(onRenovar).toHaveBeenCalledTimes(1);
  });
});
