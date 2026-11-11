import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SugerenciaAsignacion } from "./sugerencia-asignacion";
import { decidirSugerencia, fetchSugerencia } from "@/api/asignaciones-cliente";
import { ApiError } from "@/utils/api-error";
import type { RespuestaSugerencia } from "@/api/asignaciones";

jest.mock("@/api/asignaciones-cliente");

const mockFetch = fetchSugerencia as jest.MockedFunction<typeof fetchSugerencia>;
const mockDecidir = decidirSugerencia as jest.MockedFunction<typeof decidirSugerencia>;

const conSugerencia: RespuestaSugerencia = {
  socioId: "socio-1",
  sugerencia: {
    asignacionId: "a-1",
    ejercicioId: "e-1",
    ejercicioNombre: "Press inclinado",
    maquinaId: "m-1",
    maquinaNombre: "Banco plano",
    esperaSegundos: 0,
    ahorroSegundos: 120,
    creadaEn: "2026-11-05T12:00:00.000Z",
    venceEn: "2026-11-05T12:15:00.000Z",
  },
  siguienteEnOrden: null,
  calculadoEn: "2026-11-05T12:00:00.000Z",
};

const sinReserva: RespuestaSugerencia = {
  socioId: "socio-1",
  sugerencia: null,
  siguienteEnOrden: {
    ejercicioId: "e-2",
    ejercicioNombre: "Jalón al pecho",
    maquinaId: "m-2",
    esperaSegundos: 0,
  },
  calculadoEn: "2026-11-05T12:00:00.000Z",
};

describe("SugerenciaAsignacion (contenedor)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(conSugerencia);
  });

  it("le pasa a la tarjeta el estado del hook", async () => {
    render(<SugerenciaAsignacion onSeguirRutina={jest.fn()} />);

    expect(await screen.findByText("Está libre")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("'Volver a consultar' vuelve a consultar la sugerencia", async () => {
    mockFetch.mockResolvedValue(sinReserva);
    render(<SugerenciaAsignacion onSeguirRutina={jest.fn()} />);

    expect(await screen.findByText(/Ahora no tenés una reserva/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a consultar" }));

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("'Reintentar' tras un error vuelve a consultar", async () => {
    mockFetch.mockRejectedValueOnce(new ApiError(500, "boom")).mockResolvedValueOnce(conSugerencia);
    render(<SugerenciaAsignacion onSeguirRutina={jest.fn()} />);

    expect(await screen.findByText("No pudimos calcular tu próxima máquina.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Está libre")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("'Ir ahora' decide ACEPTAR y muestra la confirmación", async () => {
    mockDecidir.mockResolvedValue({ accion: "ACEPTAR", sugerencia: conSugerencia.sugerencia, siguienteEnOrden: null });
    render(<SugerenciaAsignacion onSeguirRutina={jest.fn()} />);

    expect(await screen.findByText("Está libre")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ir ahora" }));

    expect(mockDecidir).toHaveBeenCalledWith("ACEPTAR");
    expect(await screen.findByText(/Listo, te guardamos/)).toBeInTheDocument();
  });

  it("'Esperar' decide ESPERAR", async () => {
    mockDecidir.mockResolvedValue({ accion: "ESPERAR", sugerencia: null, siguienteEnOrden: null });
    render(<SugerenciaAsignacion onSeguirRutina={jest.fn()} />);

    expect(await screen.findByText("Está libre")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Esperar" }));

    expect(mockDecidir).toHaveBeenCalledWith("ESPERAR");
  });

  it("'Empezar entrenamiento' usa la misma acción que seguir la rutina", async () => {
    const onSeguirRutina = jest.fn();
    mockDecidir.mockResolvedValue({ accion: "ACEPTAR", sugerencia: conSugerencia.sugerencia, siguienteEnOrden: null });
    render(<SugerenciaAsignacion onSeguirRutina={onSeguirRutina} />);

    expect(await screen.findByText("Está libre")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ir ahora" }));
    await userEvent.click(await screen.findByRole("button", { name: "Empezar entrenamiento" }));

    expect(onSeguirRutina).toHaveBeenCalledTimes(1);
  });
});
