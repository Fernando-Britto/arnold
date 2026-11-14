import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SesionesEnCurso } from "./sesiones-en-curso";
import { fetchSesionesEnCurso, reasignarMaquinaApi } from "@/api/reasignaciones-cliente";
import { ApiError } from "@/utils/api-error";
import type { SesionEnCursoStaffDTO } from "@/api/reasignaciones";

jest.mock("@/api/reasignaciones-cliente");

const mockListar = fetchSesionesEnCurso as jest.MockedFunction<typeof fetchSesionesEnCurso>;
const mockReasignar = reasignarMaquinaApi as jest.MockedFunction<typeof reasignarMaquinaApi>;

const sesion = (over: Partial<SesionEnCursoStaffDTO> = {}): SesionEnCursoStaffDTO => ({
  sesionId: "ses-1",
  socioId: "socio-1",
  socioNombre: "Santiago Socio",
  horaInicio: "2026-11-12T18:00:00.000Z",
  ejercicioId: "e-1",
  ejercicioNombre: "Press inclinado",
  asignacionId: "asig-1",
  maquinaId: "m-1",
  maquinaNombre: "Banco plano",
  candidatos: [
    { id: "m-1", nombre: "Banco plano", estado: "DISPONIBLE" },
    { id: "m-2", nombre: "Polea alta", estado: "DISPONIBLE" },
    { id: "m-3", nombre: "Rack", estado: "FUERA_DE_SERVICIO" },
  ],
  ...over,
});

describe("SesionesEnCurso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListar.mockResolvedValue([sesion()]);
    mockReasignar.mockResolvedValue({ asignacionId: "asig-2", maquinaId: "m-2", maquinaNombre: "Polea alta" });
  });

  it("lista las sesiones con socio, ejercicio y máquina actual", async () => {
    render(<SesionesEnCurso />);

    expect(await screen.findByText("Santiago Socio")).toBeInTheDocument();
    const fila = screen.getByText(/Press inclinado/);
    expect(fila.textContent).toContain("Banco plano");
    expect(fila.textContent).toContain("desde");
  });

  it("sin sesiones abiertas muestra el estado vacío", async () => {
    mockListar.mockResolvedValue([]);
    render(<SesionesEnCurso />);

    expect(await screen.findByText("No hay sesiones en curso")).toBeInTheDocument();
  });

  it("el selector ofrece las candidatas y deshabilita las que no están disponibles", async () => {
    render(<SesionesEnCurso />);
    await screen.findByText("Santiago Socio");

    const selector = screen.getByRole("combobox", { name: /máquina para Santiago Socio/i });
    const opciones = within(selector).getAllByRole("option") as HTMLOptionElement[];

    expect(opciones.map((o) => o.textContent)).toEqual(["Banco plano", "Polea alta", "Rack"]);
    expect(opciones[2].disabled).toBe(true);
  });

  it("reasigna a la máquina elegida y refresca la lista", async () => {
    const user = userEvent.setup();
    render(<SesionesEnCurso />);
    await screen.findByText("Santiago Socio");

    await user.selectOptions(screen.getByRole("combobox", { name: /máquina para Santiago Socio/i }), "m-2");
    await user.click(screen.getByRole("button", { name: /reasignar/i }));

    expect(mockReasignar).toHaveBeenCalledWith("asig-1", "m-2");
    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
  });

  it("un 409 muestra el mensaje del servidor y refresca", async () => {
    mockReasignar.mockRejectedValue(new ApiError(409, "Esa máquina está ocupada", "MAQUINA_OCUPADA"));
    const user = userEvent.setup();
    render(<SesionesEnCurso />);
    await screen.findByText("Santiago Socio");

    await user.click(screen.getByRole("button", { name: /reasignar/i }));

    expect(await screen.findByText("Esa máquina está ocupada")).toBeInTheDocument();
    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
  });

  it("una sesión sin fila EN_CURSO no permite reasignar", async () => {
    mockListar.mockResolvedValue([sesion({ asignacionId: null, maquinaId: null, maquinaNombre: null })]);
    render(<SesionesEnCurso />);
    await screen.findByText("Santiago Socio");

    expect(screen.getByRole("button", { name: /reasignar/i })).toBeDisabled();
    expect(screen.getByText("Sin máquina asignada")).toBeInTheDocument();
  });
});
