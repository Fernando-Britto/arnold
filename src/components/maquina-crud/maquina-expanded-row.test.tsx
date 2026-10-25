import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaquinaExpandedRow } from "./maquina-expanded-row";
import { fetchMaquinaEjercicios } from "@/api/maquinas";
import { ApiError } from "@/utils/api-error";
import type { EjercicioAsociado } from "@/domains/maquina/maquina";

jest.mock("@/api/maquinas", () => ({
  fetchMaquinaEjercicios: jest.fn(),
}));

const mockFetch = fetchMaquinaEjercicios as jest.MockedFunction<
  typeof fetchMaquinaEjercicios
>;

const asociados: EjercicioAsociado[] = [
  { id: "e1", nombre: "Press de banca", grupoMuscular: "Pecho" },
  { id: "e2", nombre: "Sentadilla", grupoMuscular: "Piernas" },
];

describe("MaquinaExpandedRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("muestra la carga mientras espera la respuesta", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<MaquinaExpandedRow maquinaId="m1" />);

    expect(screen.getByText("Cargando ejercicios...")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith("m1");
  });

  it("lista los ejercicios con nombre y grupo muscular", async () => {
    mockFetch.mockResolvedValue(asociados);

    render(<MaquinaExpandedRow maquinaId="m1" />);

    expect(await screen.findByText("Press de banca")).toBeInTheDocument();
    expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByText("Pecho")).toBeInTheDocument();
    expect(screen.getByText("Piernas")).toBeInTheDocument();
    expect(screen.queryByText("Cargando ejercicios...")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando la máquina no tiene ejercicios", async () => {
    mockFetch.mockResolvedValue([]);

    render(<MaquinaExpandedRow maquinaId="m1" />);

    expect(
      await screen.findByText("Esta máquina no tiene ejercicios asignados")
    ).toBeInTheDocument();
  });

  it("muestra el error y reintenta la carga", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockRejectedValueOnce(new ApiError(500, "boom"))
      .mockResolvedValueOnce(asociados);

    render(<MaquinaExpandedRow maquinaId="m1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo procesar la solicitud. Probá de nuevo más tarde."
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Press de banca")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("usa el texto de respaldo en español cuando el error no es de la API", async () => {
    mockFetch.mockRejectedValue(new Error("boom"));

    render(<MaquinaExpandedRow maquinaId="m1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los ejercicios de la máquina"
    );
  });

  it("llama a onAsignar con el id de la máquina", async () => {
    const user = userEvent.setup();
    const onAsignar = jest.fn();
    mockFetch.mockResolvedValue(asociados);

    render(<MaquinaExpandedRow maquinaId="m1" onAsignar={onAsignar} />);
    await screen.findByText("Press de banca");

    await user.click(screen.getByRole("button", { name: "Asignar ejercicios" }));

    expect(onAsignar).toHaveBeenCalledWith("m1");
  });
});
