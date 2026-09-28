import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  TarjetaDetalle,
  formatDescansoLabel,
  getMachineAvailabilityMessage,
  type EjercicioActualInfo,
  type EjercicioEnRutinaActual,
  type MaquinaInfo,
} from "./tarjeta-detalle";

describe("formatDescansoLabel (spec: home-socio-portal §Edge Cases)", () => {
  it('formats a round-minute value as "N min" (descanso=120 -> "2 min")', () => {
    expect(formatDescansoLabel(120)).toBe("2 min");
  });

  it('formats a round single-minute value as "1 min" (descanso=60)', () => {
    expect(formatDescansoLabel(60)).toBe("1 min");
  });

  it('formats a non-round value as "M:SS" (descanso=125 -> "2:05")', () => {
    expect(formatDescansoLabel(125)).toBe("2:05");
  });

  it('formats sub-minute non-round values as "0:SS" (descanso=45)', () => {
    expect(formatDescansoLabel(45)).toBe("0:45");
  });

  it("pads seconds under 10 with a leading zero", () => {
    expect(formatDescansoLabel(65)).toBe("1:05");
  });
});

describe("getMachineAvailabilityMessage (RN-05, spec: home-socio-portal §Requirement Tarjeta_Detalle, AC-004)", () => {
  it("returns a ready message when the machine is DISPONIBLE", () => {
    const maquina: MaquinaInfo = { estado: "DISPONIBLE" };
    expect(getMachineAvailabilityMessage(maquina)).toBe("Máquina disponible");
  });

  it('returns "Libre en ~N min" when OCUPADA with an estimate', () => {
    const maquina: MaquinaInfo = { estado: "OCUPADA", tiempoLibreEstimadoMin: 5 };
    expect(getMachineAvailabilityMessage(maquina)).toBe("Libre en ~5 min");
  });

  it("returns a neutral occupied message when OCUPADA without an estimate", () => {
    const maquina: MaquinaInfo = { estado: "OCUPADA" };
    expect(getMachineAvailabilityMessage(maquina)).toBe("Ocupada");
  });

  it("NEVER reports FUERA_DE_SERVICIO as available (RN-05 / AC-004)", () => {
    const maquina: MaquinaInfo = { estado: "FUERA_DE_SERVICIO" };
    const message = getMachineAvailabilityMessage(maquina);
    expect(message).not.toMatch(/disponible/i);
    expect(message).not.toMatch(/libre/i);
    expect(message).toBe("Fuera de servicio");
  });

  it("NEVER reports INACTIVA as available (RN-05 / AC-004)", () => {
    const maquina: MaquinaInfo = { estado: "INACTIVA" };
    const message = getMachineAvailabilityMessage(maquina);
    // "No disponible" legitimately contains the substring "disponible" —
    // assert the affirmative-availability phrasing is absent, not the substring.
    expect(message).not.toBe("Máquina disponible");
    expect(message).not.toMatch(/libre/i);
    expect(message).toBe("No disponible");
  });

  it('falls back to "Consultar en recepción" when machine data is missing (MACHINE_STATUS_UNAVAILABLE)', () => {
    expect(getMachineAvailabilityMessage(null)).toBe("Consultar en recepción");
    expect(getMachineAvailabilityMessage(undefined)).toBe("Consultar en recepción");
  });
});

describe("TarjetaDetalle", () => {
  const ejercicio: EjercicioActualInfo = {
    nombre: "Press de banca",
    grupoMuscular: "Pecho",
    descripcion: "Acostado en el banco, baja la barra al pecho y empuja hacia arriba.",
  };

  const ejercicioEnRutina: EjercicioEnRutinaActual = {
    series: 3,
    repeticiones: 10,
    descanso: 120,
  };

  it('renders the full structure for the current exercise (spec scenario: label, name, group, "3×10", "2 min", description)', () => {
    render(
      <TarjetaDetalle
        ejercicio={ejercicio}
        ejercicioEnRutina={ejercicioEnRutina}
        objetivo="25 kg"
      />
    );

    expect(screen.getByText("EJERCICIO ACTUAL")).toBeInTheDocument();
    expect(screen.getByText("Press de banca")).toBeInTheDocument();
    expect(screen.getByText("Pecho")).toBeInTheDocument();
    expect(screen.getByText("3×10")).toBeInTheDocument();
    expect(screen.getByText("2 min")).toBeInTheDocument();
    expect(screen.getByText("25 kg")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Acostado en el banco, baja la barra al pecho y empuja hacia arriba."
      )
    ).toBeInTheDocument();
  });

  it("shows a placeholder (not a blank cell) for Objetivo when no target weight is available yet", () => {
    render(
      <TarjetaDetalle ejercicio={ejercicio} ejercicioEnRutina={ejercicioEnRutina} />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows an empty state instead of the exercise structure when there is no active routine (spec: Tarjeta_Rutina/Tarjeta_Detalle empty state)", () => {
    render(<TarjetaDetalle ejercicio={null} ejercicioEnRutina={null} />);

    expect(screen.getByText(/sin rutina asignada/i)).toBeInTheDocument();
    expect(screen.queryByText("EJERCICIO ACTUAL")).not.toBeInTheDocument();
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it("renders the machine-availability footer using getMachineAvailabilityMessage (AC-004)", () => {
    render(
      <TarjetaDetalle
        ejercicio={ejercicio}
        ejercicioEnRutina={ejercicioEnRutina}
        maquina={{ estado: "OCUPADA", tiempoLibreEstimadoMin: 5 }}
      />
    );
    expect(screen.getByText("Libre en ~5 min")).toBeInTheDocument();
  });

  it("shows the neutral recepción message in the footer when machine data is unavailable", () => {
    render(
      <TarjetaDetalle ejercicio={ejercicio} ejercicioEnRutina={ejercicioEnRutina} />
    );
    expect(screen.getByText("Consultar en recepción")).toBeInTheDocument();
  });

  it("never shows the footer as available for a FUERA_DE_SERVICIO machine, even inside the card (RN-05)", () => {
    render(
      <TarjetaDetalle
        ejercicio={ejercicio}
        ejercicioEnRutina={ejercicioEnRutina}
        maquina={{ estado: "FUERA_DE_SERVICIO" }}
      />
    );
    expect(screen.getByText("Fuera de servicio")).toBeInTheDocument();
    expect(screen.queryByText(/^Máquina disponible$/)).not.toBeInTheDocument();
  });

  it('opens a detail modal with the full description when the exercise name is clicked (spec scenario: "Click exercise name opens detail modal")', async () => {
    const user = userEvent.setup();
    render(
      <TarjetaDetalle ejercicio={ejercicio} ejercicioEnRutina={ejercicioEnRutina} />
    );

    expect(
      screen.queryByRole("dialog", { name: /press de banca/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Press de banca" }));

    const dialog = screen.getByRole("dialog", { name: /press de banca/i });
    expect(dialog).toBeInTheDocument();
    // Scoped to the dialog: the same description also renders in the card
    // body behind it, so an unscoped query would match twice.
    expect(
      within(dialog).getByText(
        "Acostado en el banco, baja la barra al pecho y empuja hacia arriba."
      )
    ).toBeInTheDocument();
  });

  it("closes the detail modal when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TarjetaDetalle ejercicio={ejercicio} ejercicioEnRutina={ejercicioEnRutina} />
    );

    await user.click(screen.getByRole("button", { name: "Press de banca" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onOpenDetail instead of the internal modal when provided (lets a parent page own richer detail — form variations, machine alternatives)", async () => {
    const onOpenDetail = jest.fn();
    const user = userEvent.setup();
    render(
      <TarjetaDetalle
        ejercicio={ejercicio}
        ejercicioEnRutina={ejercicioEnRutina}
        onOpenDetail={onOpenDetail}
      />
    );

    await user.click(screen.getByRole("button", { name: "Press de banca" }));

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
