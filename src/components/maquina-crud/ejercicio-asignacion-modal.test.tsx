import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjercicioAsignacionModal } from "./ejercicio-asignacion-modal";
import { fetchEjerciciosBusqueda } from "@/api/ejercicios";
import { fetchMaquinaEjercicios, reemplazarEjerciciosMaquina } from "@/api/maquinas";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";
import type { EjercicioConUso } from "@/domains/ejercicio/ejercicio";

jest.mock("@/api/ejercicios", () => ({ fetchEjerciciosBusqueda: jest.fn() }));
jest.mock("@/api/maquinas", () => ({ fetchMaquinaEjercicios: jest.fn(), reemplazarEjerciciosMaquina: jest.fn() }));
jest.mock("@/contexts/notifications");

const mockBusqueda = fetchEjerciciosBusqueda as jest.MockedFunction<typeof fetchEjerciciosBusqueda>;
const mockAsignados = fetchMaquinaEjercicios as jest.MockedFunction<typeof fetchMaquinaEjercicios>;
const mockGuardar = reemplazarEjerciciosMaquina as jest.MockedFunction<typeof reemplazarEjerciciosMaquina>;
const mockNotify = jest.fn();
const eje = (id: string, nombre: string, grupoMuscular = "Pecho") =>
  ({ id, nombre, grupoMuscular, enRutinas: 0 }) as EjercicioConUso;
const pagina = (cantidad: number) => Array.from({ length: cantidad }, (_, i) => eje(`p${i}`, `Ejercicio ${i}`));
const avanzarDebounce = () => act(async () => { jest.advanceTimersByTime(300); });
const renderModal = (props: Partial<React.ComponentProps<typeof EjercicioAsignacionModal>> = {}) =>
  render(<EjercicioAsignacionModal open maquinaId="m1" onClose={jest.fn()} {...props} />);

describe("EjercicioAsignacionModal", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNotify.mockReset();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    mockAsignados.mockResolvedValue([]);
    mockBusqueda.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it("es un diálogo accesible; Escape y Cerrar lo cierran devolviendo el foco", async () => {
    function Harness() {
      const [abierto, setAbierto] = React.useState(false);
      return (
        <div>
          <button type="button" onClick={() => setAbierto(true)}>Abrir modal</button>
          <EjercicioAsignacionModal open={abierto} maquinaId="m1" onClose={() => setAbierto(false)} />
        </div>
      );
    }
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir modal" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Asignar ejercicios" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("debouncea ~300 ms, consulta con limit=50 y encuentra 'Tríceps' con 'triceps'", async () => {
    mockBusqueda.mockResolvedValue([eje("t1", "Tríceps", "Brazos")]);
    renderModal();
    await avanzarDebounce();
    await waitFor(() => expect(mockBusqueda).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Buscar ejercicios"), { target: { value: "triceps" } });
    await act(async () => { jest.advanceTimersByTime(299); });
    expect(mockBusqueda).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1); });

    await waitFor(() => expect(mockBusqueda).toHaveBeenCalledTimes(2));
    expect(mockBusqueda).toHaveBeenLastCalledWith({ search: "triceps", limit: 50, offset: 0 });
    expect(await screen.findByText("Tríceps")).toBeInTheDocument();
  });

  it("premarca lo asignado fuera de la página, conserva la selección al buscar y guarda el reemplazo", async () => {
    mockAsignados.mockResolvedValue([
      { id: "fuera", nombre: "Press militar", grupoMuscular: "Hombros" },
      { id: "v1", nombre: "Sentadilla", grupoMuscular: "Piernas" },
    ]);
    mockBusqueda.mockImplementation(({ search }) =>
      Promise.resolve(search ? [eje("n1", "Bíceps")] : [eje("v1", "Sentadilla", "Piernas")])
    );
    mockGuardar.mockResolvedValue([]);
    const onClose = jest.fn();
    const onSaved = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal({ onClose, onSaved });
    await avanzarDebounce();

    expect(await screen.findByText("2 seleccionados")).toBeInTheDocument();
    const sentadilla = await screen.findByLabelText("Sentadilla");
    expect(sentadilla).toBeChecked();
    await user.click(sentadilla);
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar ejercicios"), { target: { value: "biceps" } });
    await avanzarDebounce();
    expect(await screen.findByText("Bíceps")).toBeInTheDocument();
    expect(screen.queryByText("Sentadilla")).not.toBeInTheDocument();
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();
    await user.click(await screen.findByLabelText("Bíceps"));
    expect(screen.getByText("2 seleccionados")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith("m1", ["fuera", "n1"]));
    expect(mockNotify).toHaveBeenCalledWith("success", "Ejercicios asignados");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("'Ver más' aparece con página completa, avanza el offset, acumula y se oculta al final", async () => {
    mockBusqueda.mockResolvedValueOnce(pagina(50)).mockResolvedValueOnce([eje("x1", "Extra uno")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("Ejercicio 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver más" }));
    await waitFor(() => expect(mockBusqueda).toHaveBeenLastCalledWith({ search: "", limit: 50, offset: 50 }));
    expect(await screen.findByText("Extra uno")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });

  it("oculta 'Ver más' cuando la última página vuelve corta", async () => {
    mockBusqueda.mockResolvedValue(pagina(49));
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("Ejercicio 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });

  it("'Seleccionar todo visible' solo afecta la página visible", async () => {
    mockAsignados.mockResolvedValue([{ id: "fuera", nombre: "Press militar", grupoMuscular: "Hombros" }]);
    mockBusqueda.mockResolvedValue([eje("v1", "Uno"), eje("v2", "Dos")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("1 seleccionado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seleccionar todo visible" }));
    expect(screen.getByText("3 seleccionados")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seleccionar todo visible" }));
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();
  });

  it("un error del servidor se muestra adentro y deja el modal abierto con la selección", async () => {
    mockBusqueda.mockResolvedValue([eje("v1", "Sentadilla")]);
    mockGuardar.mockRejectedValue(new ApiError(400, "No se pueden asignar más de 100 ejercicios", "VALIDATION_MAX_EJERCICIOS"));
    const onClose = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal({ onClose });
    await avanzarDebounce();

    await user.click(await screen.findByLabelText("Sentadilla"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    const dialog = screen.getByRole("dialog", { name: "Asignar ejercicios" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pueden asignar más de 100 ejercicios");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Sentadilla")).toBeChecked();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
  });
});
