import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TarjetaRutina, type EjercicioSecuencia } from "./tarjeta-rutina";

const ejercicios: EjercicioSecuencia[] = [
  { id: "e1", nombre: "Press de Banca", series: 4, repeticiones: 8, descanso: 120 },
  { id: "e2", nombre: "Press Militar", series: 3, repeticiones: 10, descanso: 120 },
  { id: "e3", nombre: "Aperturas", series: 3, repeticiones: 12, descanso: 60 },
  { id: "e4", nombre: "Tríceps en polea", series: 4, repeticiones: 12, descanso: 0 },
];

describe("TarjetaRutina (spec: matches Home_Socio_1x §Fila2, horizontal sequence)", () => {
  it("shows an empty state when there is no active routine", () => {
    render(<TarjetaRutina rutinaNombre={null} ejercicios={[]} indiceActual={0} />);
    expect(screen.getByText(/sin rutina asignada/i)).toBeInTheDocument();
  });

  it("renders the label and the routine name", () => {
    render(
      <TarjetaRutina
        rutinaNombre="Hipertrofia - Empuje A"
        ejercicios={ejercicios}
        indiceActual={1}
      />
    );
    expect(screen.getByText("MI RUTINA ASIGNADA")).toBeInTheDocument();
    expect(screen.getByText("Hipertrofia - Empuje A")).toBeInTheDocument();
  });

  it('renders each exercise with its "seriesxreps" using a literal "x" (matches the design copy)', () => {
    render(
      <TarjetaRutina
        rutinaNombre="Hipertrofia - Empuje A"
        ejercicios={ejercicios}
        indiceActual={1}
      />
    );
    expect(screen.getByText("Press de Banca")).toBeInTheDocument();
    expect(screen.getByText("4x8")).toBeInTheDocument();
    expect(screen.getByText("3x10")).toBeInTheDocument();
    expect(screen.getByText("3x12")).toBeInTheDocument();
    expect(screen.getByText("4x12")).toBeInTheDocument();
  });

  it("renders one rest connector between each pair of consecutive exercises, formatted with formatDescansoLabel", () => {
    render(
      <TarjetaRutina
        rutinaNombre="Hipertrofia - Empuje A"
        ejercicios={ejercicios}
        indiceActual={1}
      />
    );
    // 4 exercises -> 3 connectors
    expect(screen.getAllByText("Descanso")).toHaveLength(3);
    expect(screen.getAllByText("2 min")).toHaveLength(2); // e1->e2 (120s), e2->e3 (120s)
    expect(screen.getByText("1 min")).toBeInTheDocument(); // e3->e4 (60s)
  });

  it("marks exercises before indiceActual as completed and the one at indiceActual as current", () => {
    render(
      <TarjetaRutina
        rutinaNombre="Hipertrofia - Empuje A"
        ejercicios={ejercicios}
        indiceActual={1}
      />
    );
    expect(screen.getByTestId("ejercicio-e1")).toHaveAttribute("data-estado", "completado");
    expect(screen.getByTestId("ejercicio-e2")).toHaveAttribute("data-estado", "actual");
    expect(screen.getByTestId("ejercicio-e3")).toHaveAttribute("data-estado", "pendiente");
    expect(screen.getByTestId("ejercicio-e4")).toHaveAttribute("data-estado", "pendiente");
  });

  it("renders one progress-bar segment per exercise, reflecting the same completed/actual/pendiente state", () => {
    render(
      <TarjetaRutina
        rutinaNombre="Hipertrofia - Empuje A"
        ejercicios={ejercicios}
        indiceActual={1}
      />
    );
    const segments = screen.getAllByTestId("progreso-segmento");
    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.getAttribute("data-estado"))).toEqual([
      "completado",
      "actual",
      "pendiente",
      "pendiente",
    ]);
  });

  it('calls onSeguirRutina when "Seguir rutina" is clicked', async () => {
    const onSeguirRutina = jest.fn();
    const user = userEvent.setup();
    render(
      <TarjetaRutina
        rutinaNombre="Hipertrofia - Empuje A"
        ejercicios={ejercicios}
        indiceActual={1}
        onSeguirRutina={onSeguirRutina}
      />
    );
    await user.click(screen.getByRole("button", { name: /seguir rutina/i }));
    expect(onSeguirRutina).toHaveBeenCalledTimes(1);
  });
});
