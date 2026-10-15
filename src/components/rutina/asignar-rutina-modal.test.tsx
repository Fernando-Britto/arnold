/**
 * AsignarRutinaModal (T-034): buscar socio por DNI, elegir rutina y confirmar la asignación.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AsignarRutinaModal } from "./asignar-rutina-modal";
import { useNotifications } from "@/contexts/notifications";
import { fetchSocioPorDni } from "@/api/socios";
import { fetchRutinas } from "@/api/rutinas";
import { createAsignacionRutina } from "@/api/rutinas-asignadas";
import { ApiError } from "@/utils/api-error";

jest.mock("@/contexts/notifications");
jest.mock("@/api/socios", () => ({ fetchSocioPorDni: jest.fn() }));
jest.mock("@/api/rutinas", () => ({ fetchRutinas: jest.fn() }));
jest.mock("@/api/rutinas-asignadas", () => ({ createAsignacionRutina: jest.fn() }));

const mockNotify = jest.fn();
const mockFetchSocio = fetchSocioPorDni as jest.MockedFunction<typeof fetchSocioPorDni>;
const mockFetchRutinas = fetchRutinas as jest.MockedFunction<typeof fetchRutinas>;
const mockAsignar = createAsignacionRutina as jest.MockedFunction<typeof createAsignacionRutina>;

const socio = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: null,
  membresia: null,
  estadoCuota: "AL_DIA" as const,
  plan: null,
  oferta: null,
};

const rutinas = [
  {
    id: "rutina-1",
    nombre: "Full Body",
    objetivoPrincipal: "General",
    frecuenciaSemanal: 3,
    duracionEstimada: 60,
    nivelDeDificultad: "INTERMEDIO" as const,
    descripcion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { ejercicios: 5 },
  },
];

async function elegirSocioYRutina(user: ReturnType<typeof userEvent.setup>) {
  mockFetchSocio.mockResolvedValueOnce(socio);
  await user.type(screen.getByLabelText("DNI"), "30123456");
  await user.click(screen.getByRole("button", { name: /buscar/i }));
  await screen.findByText("Ana García");
  await user.selectOptions(await screen.findByLabelText("Rutina"), "rutina-1");
}

describe("AsignarRutinaModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    mockFetchRutinas.mockResolvedValue(rutinas);
  });

  it("carga las rutinas y arma el dropdown con nombre, nivel y duración", async () => {
    const user = userEvent.setup();
    mockFetchSocio.mockResolvedValueOnce(socio);
    render(<AsignarRutinaModal onClose={jest.fn()} />);

    await user.type(screen.getByLabelText("DNI"), "30123456");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await screen.findByText("Ana García");

    expect(await screen.findByText("Full Body (Nivel: Intermedio, 60 min)")).toBeInTheDocument();
  });

  it("'Asignar' está deshabilitado hasta elegir socio y rutina", async () => {
    const user = userEvent.setup();
    render(<AsignarRutinaModal onClose={jest.fn()} />);

    const asignar = screen.getByRole("button", { name: /^asignar$/i });
    expect(asignar).toBeDisabled();

    mockFetchSocio.mockResolvedValueOnce(socio);
    await user.type(screen.getByLabelText("DNI"), "30123456");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await screen.findByText("Ana García");
    expect(asignar).toBeDisabled();

    await user.selectOptions(await screen.findByLabelText("Rutina"), "rutina-1");
    expect(asignar).toBeEnabled();
  });

  it("confirma la asignación, avisa éxito y cierra el modal", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onAsignada = jest.fn();
    mockAsignar.mockResolvedValueOnce({
      success: true,
      message: "Rutina asignada",
      rutinaAsignada: { id: "asig-1", socioId: "socio-1", rutinaId: "rutina-1", activa: true },
    } as never);
    render(<AsignarRutinaModal onClose={onClose} onAsignada={onAsignada} />);

    await elegirSocioYRutina(user);
    await user.click(screen.getByRole("button", { name: /^asignar$/i }));

    await waitFor(() =>
      expect(mockAsignar).toHaveBeenCalledWith({ socioId: "socio-1", rutinaId: "rutina-1" })
    );
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringContaining("Ana García"));
    expect(onAsignada).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("muestra el error de la API al confirmar y no avisa éxito ni cierra", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    mockAsignar.mockRejectedValueOnce(new ApiError(409, "Ya hay una rutina activa asignada a este socio"));
    render(<AsignarRutinaModal onClose={onClose} />);

    await elegirSocioYRutina(user);
    await user.click(screen.getByRole("button", { name: /^asignar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya hay una rutina activa asignada a este socio"
    );
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("muestra 'Socio no encontrado' cuando la búsqueda por DNI falla", async () => {
    const user = userEvent.setup();
    mockFetchSocio.mockRejectedValueOnce(new ApiError(404, "Socio no encontrado"));
    render(<AsignarRutinaModal onClose={jest.fn()} />);

    await user.type(screen.getByLabelText("DNI"), "00000000");
    await user.click(screen.getByRole("button", { name: /buscar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Socio no encontrado");
  });

  it("'Cancelar' cierra el modal sin asignar", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<AsignarRutinaModal onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockAsignar).not.toHaveBeenCalled();
  });
});
