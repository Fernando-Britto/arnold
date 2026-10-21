import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MiRutinaSection } from "./mi-rutina-section";
import { MisEjerciciosSection } from "./mis-ejercicios-section";
import { ProgresoDetalleSection } from "./progreso-detalle-section";
import { PagosSection } from "./pagos-section";
import { AsistenciasSection } from "./asistencias-section";
import type {
  EjercicioDeRutinaDTO,
  MembresiaSeccionDTO,
  ProgresoEjercicioDTO,
} from "@/api/home-socio-secciones";

const ejercicio = (over: Partial<EjercicioDeRutinaDTO> = {}): EjercicioDeRutinaDTO => ({
  id: "e1",
  nombre: "Press de Banca",
  grupoMuscular: "Pecho",
  descripcion: "Baja la barra al pecho.",
  series: 4,
  repeticiones: 8,
  descanso: 120,
  mejorMarca: 80,
  mediaId: null,
  equipamiento: null,
  musculoObjetivo: null,
  instrucciones: [],
  ...over,
});

describe("MiRutinaSection (T-039 §Mi rutina)", () => {
  const base = {
    rutina: { nombre: "Hipertrofia A", rutinaAsignadaId: "ra1", ejercicios: [ejercicio()] },
    sesiones: [
      { id: "s1", horaInicio: "2026-10-06T13:00:00.000Z", horaFin: "2026-10-06T14:05:00.000Z", estado: "COMPLETADA", duracionMin: 65 },
    ],
    sesionEnCurso: null,
  };

  it("muestra la rutina, sus ejercicios y el historial de sesiones", () => {
    render(<MiRutinaSection {...base} />);
    expect(screen.getByText("Hipertrofia A")).toBeInTheDocument();
    expect(screen.getByText("Press de Banca")).toBeInTheDocument();
    expect(screen.getByText("4 × 8")).toBeInTheDocument();
    expect(screen.getByText("120s")).toBeInTheDocument();
    expect(screen.getByTestId("sesion-historial")).toHaveTextContent("65 min");
    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  it("ofrece retomar una sesión en curso", async () => {
    const onSeguirRutina = jest.fn();
    const user = userEvent.setup();
    render(
      <MiRutinaSection
        {...base}
        sesionEnCurso={{ id: "s2", horaInicio: "2026-10-07T13:00:00.000Z", ejercicioActualId: "e1", serieActual: 2 }}
        onSeguirRutina={onSeguirRutina}
      />
    );
    await user.click(screen.getByRole("button", { name: /retomar sesión/i }));
    expect(onSeguirRutina).toHaveBeenCalledTimes(1);
  });

  it("estado vacío sin rutina ni sesiones", () => {
    render(<MiRutinaSection rutina={null} sesiones={[]} sesionEnCurso={null} />);
    expect(screen.getByText(/no tenés una rutina asignada/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no registraste sesiones/i)).toBeInTheDocument();
  });
});

describe("MisEjerciciosSection (T-039 §Mis ejercicios)", () => {
  it("muestra descripción y mejor marca", () => {
    render(<MisEjerciciosSection ejercicios={[ejercicio(), ejercicio({ id: "e2", nombre: "Remo", descripcion: null, mejorMarca: null })]} />);
    expect(screen.getByText("Baja la barra al pecho.")).toBeInTheDocument();
    expect(screen.getByText("Sin descripción.")).toBeInTheDocument();
    expect(screen.getAllByTestId("mejor-marca")[0]).toHaveTextContent("80 kg");
    expect(screen.getAllByTestId("mejor-marca")[1]).toHaveTextContent("Sin registros");
  });

  it("estado vacío sin ejercicios", () => {
    render(<MisEjerciciosSection ejercicios={[]} />);
    expect(screen.getByText(/no tenés ejercicios asignados/i)).toBeInTheDocument();
  });
});

describe("ProgresoDetalleSection (T-039 §Progreso)", () => {
  const progreso: ProgresoEjercicioDTO[] = [
    {
      ejercicioId: "e1",
      ejercicioNombre: "Press de Banca",
      serie: [
        { fecha: "2026-09-22", carga: 60 },
        { fecha: "2026-10-05", carga: 65 },
      ],
      mejorMarca: 65,
      delta: 5,
    },
  ];

  it("dibuja una barra por punto y muestra la mejor marca", () => {
    render(<ProgresoDetalleSection progreso={progreso} />);
    expect(screen.getAllByTestId("progreso-barra")).toHaveLength(2);
    expect(screen.getByTestId("progreso-delta")).toHaveTextContent("+5 kg");
    expect(screen.getByText(/mejor marca/i)).toBeInTheDocument();
  });

  it("estado vacío sin registros", () => {
    render(<ProgresoDetalleSection progreso={[]} />);
    expect(screen.getByText(/todavía no registraste entrenamientos/i)).toBeInTheDocument();
  });
});

describe("PagosSection (T-039 §Mis pagos y membresía)", () => {
  const membresia: MembresiaSeccionDTO = {
    planNombre: "Plan Musculación",
    estado: "AL_DIA",
    ultimoPeriodoCubierto: "2026-10",
    fechaVencimiento: "2026-10-31T23:59:59.999-03:00",
    historial: [
      { id: "p1", fechaPago: "2026-10-02T13:00:00.000Z", monto: 100, metodoPago: "EFECTIVO", periodo: "2026-10" },
    ],
  };

  it("muestra el estado calculado, la cobertura y el historial", () => {
    render(<PagosSection membresia={membresia} />);
    expect(screen.getByTestId("estado-pago")).toHaveTextContent("Al día");
    expect(screen.getByText("Plan Musculación")).toBeInTheDocument();
    expect(screen.getByTestId("pago-historial")).toHaveTextContent("Efectivo");
    expect(screen.getByTestId("pago-historial")).toHaveTextContent("$ 100");
    expect(screen.getByText(/octubre de 2026/i)).toBeInTheDocument();
  });

  it("estado vacío sin membresía", () => {
    render(<PagosSection membresia={null} />);
    expect(screen.getByText(/no tenés pagos ni membresía/i)).toBeInTheDocument();
  });
});

describe("AsistenciasSection (T-039 §Mis asistencias)", () => {
  it("muestra la racha, el total y el calendario", () => {
    const dias = Array.from({ length: 35 }, (_, i) => ({
      fecha: `2026-09-${String(3 + i).padStart(2, "0")}`,
      asistio: i % 7 === 0,
    }));
    render(<AsistenciasSection asistencias={{ rachaSemanas: 3, total: 5, dias }} />);
    expect(screen.getByTestId("asistencias-racha")).toHaveTextContent("3");
    expect(screen.getByTestId("asistencias-total")).toHaveTextContent("5");
    expect(screen.getAllByTestId("asistencia-celda")).toHaveLength(35);
  });

  it("estado vacío sin asistencias", () => {
    const dias = Array.from({ length: 35 }, (_, i) => ({ fecha: `2026-09-${String(3 + i).padStart(2, "0")}`, asistio: false }));
    render(<AsistenciasSection asistencias={{ rachaSemanas: 0, total: 0, dias }} />);
    expect(screen.getByText(/todavía no registraste asistencias/i)).toBeInTheDocument();
  });
});
