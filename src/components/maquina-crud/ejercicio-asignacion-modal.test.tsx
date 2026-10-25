import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EjercicioAsignacionModal } from "./ejercicio-asignacion-modal";
import { fetchEjerciciosBusqueda } from "@/api/ejercicios";
import { fetchMaquinaEjercicios, reemplazarEjerciciosMaquina } from "@/api/maquinas";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";
import { GRUPOS_MUSCULARES, type EjercicioConUso } from "@/domains/ejercicio/ejercicio";

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
const elegirGrupo = (valor: string) =>
  fireEvent.change(screen.getByLabelText("Filtrar por grupo muscular"), { target: { value: valor } });

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

  it("muestra el filtro 'Grupo muscular' con la lista canónica y 'Todos los grupos'", async () => {
    renderModal();
    await avanzarDebounce();

    expect(screen.getByText("Grupo muscular")).toBeInTheDocument();
    const select = screen.getByLabelText("Filtrar por grupo muscular");
    expect(select).toHaveValue("");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Todos los grupos",
      ...GRUPOS_MUSCULARES,
    ]);
  });

  it("el filtro envía muscleGroup y reemplaza la lista desde la primera página", async () => {
    mockBusqueda.mockImplementation(({ muscleGroup }) =>
      Promise.resolve(muscleGroup ? [eje("f1", "Sentadilla", "Piernas")] : [eje("v1", "Press banca")])
    );
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("Press banca")).toBeInTheDocument();

    elegirGrupo("Piernas");

    await waitFor(() =>
      expect(mockBusqueda).toHaveBeenLastCalledWith({
        search: "",
        muscleGroup: "Piernas",
        limit: 50,
        offset: 0,
      })
    );
    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
    expect(screen.queryByText("Press banca")).not.toBeInTheDocument();
  });

  it("cambiar el filtro después de 'Ver más' vuelve al offset 0 y descarta las páginas previas", async () => {
    mockBusqueda
      .mockResolvedValueOnce(pagina(50))
      .mockResolvedValueOnce([eje("x1", "Extra")])
      .mockResolvedValueOnce([eje("f1", "Filtrado", "Piernas")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("Ejercicio 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver más" }));
    expect(await screen.findByText("Extra")).toBeInTheDocument();

    elegirGrupo("Piernas");

    await waitFor(() =>
      expect(mockBusqueda).toHaveBeenLastCalledWith({
        search: "",
        muscleGroup: "Piernas",
        limit: 50,
        offset: 0,
      })
    );
    expect(await screen.findByText("Filtrado")).toBeInTheDocument();
    expect(screen.queryByText("Ejercicio 0")).not.toBeInTheDocument();
  });

  it("cambiar la búsqueda después de 'Ver más' vuelve al offset 0", async () => {
    mockBusqueda
      .mockResolvedValueOnce(pagina(50))
      .mockResolvedValueOnce([eje("x1", "Extra")])
      .mockResolvedValueOnce([eje("s1", "Bíceps")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("Ejercicio 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver más" }));
    expect(await screen.findByText("Extra")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar ejercicios"), { target: { value: "biceps" } });
    await avanzarDebounce();

    await waitFor(() =>
      expect(mockBusqueda).toHaveBeenLastCalledWith({ search: "biceps", limit: 50, offset: 0 })
    );
    expect(await screen.findByText("Bíceps")).toBeInTheDocument();
    expect(screen.queryByText("Extra")).not.toBeInTheDocument();
  });

  it("'Todos los grupos' no envía muscleGroup", async () => {
    mockBusqueda.mockResolvedValue([eje("v1", "Uno")]);
    renderModal();
    await avanzarDebounce();

    elegirGrupo("Piernas");
    await waitFor(() =>
      expect(mockBusqueda).toHaveBeenLastCalledWith(
        expect.objectContaining({ muscleGroup: "Piernas" })
      )
    );

    elegirGrupo("");
    await waitFor(() =>
      expect(mockBusqueda).toHaveBeenLastCalledWith({ search: "", limit: 50, offset: 0 })
    );
    expect(mockBusqueda.mock.lastCall?.[0]).not.toHaveProperty("muscleGroup");
  });

  it("la selección persiste al cambiar de filtro", async () => {
    mockBusqueda.mockImplementation(({ muscleGroup }) =>
      Promise.resolve(muscleGroup ? [eje("f1", "Sentadilla", "Piernas")] : [eje("v1", "Press banca")])
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();

    await user.click(await screen.findByLabelText("Press banca"));
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();

    elegirGrupo("Piernas");
    expect(await screen.findByLabelText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Sentadilla"));
    expect(screen.getByText("2 seleccionados")).toBeInTheDocument();
  });

  it("'Seleccionar los visibles' selecciona todo lo cargado y 'Quitar los visibles' lo quita", async () => {
    mockAsignados.mockResolvedValue([{ id: "fuera", nombre: "Press militar", grupoMuscular: "Hombros" }]);
    mockBusqueda.mockResolvedValue([eje("v1", "Uno"), eje("v2", "Dos")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("1 seleccionado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seleccionar los visibles" }));
    expect(screen.getByText("3 seleccionados")).toBeInTheDocument();
    expect(screen.getByLabelText("Uno")).toBeChecked();
    expect(screen.getByLabelText("Dos")).toBeChecked();
    expect(screen.queryByText(/Solo se pueden asignar/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar los visibles" }));
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();
    expect(screen.getByLabelText("Uno")).not.toBeChecked();
    expect(screen.getByLabelText("Dos")).not.toBeChecked();
  });

  it("'Seleccionar los visibles' incluye todas las páginas cargadas", async () => {
    mockBusqueda.mockResolvedValueOnce(pagina(50)).mockResolvedValueOnce([eje("x1", "Extra")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("Ejercicio 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver más" }));
    expect(await screen.findByText("Extra")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seleccionar los visibles" }));
    expect(screen.getByText("51 seleccionados")).toBeInTheDocument();
    expect(screen.getByLabelText("Ejercicio 0")).toBeChecked();
    expect(screen.getByLabelText("Extra")).toBeChecked();
  });

  it("el tope de 100 recorta los visibles y avisa cuántos seleccionó", async () => {
    mockAsignados.mockResolvedValue(
      Array.from({ length: 99 }, (_, i) => ({ id: `a${i}`, nombre: `Asignado ${i}`, grupoMuscular: "Pecho" }))
    );
    mockBusqueda.mockResolvedValue([eje("v1", "Uno"), eje("v2", "Dos"), eje("v3", "Tres")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("99 seleccionados")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seleccionar los visibles" }));
    expect(screen.getByText("100 seleccionados")).toBeInTheDocument();
    expect(
      screen.getByText("Solo se pueden asignar hasta 100 ejercicios. Se seleccionaron los primeros 1.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Uno")).toBeChecked();
    expect(screen.getByLabelText("Dos")).not.toBeChecked();
    expect(screen.getByLabelText("Tres")).not.toBeChecked();
  });

  it("con el tope ya alcanzado avisa que ya hay 100 seleccionados", async () => {
    const asignados = Array.from({ length: 100 }, (_, i) => ({
      id: `a-${i}`,
      nombre: `Asignado ${i}`,
      grupoMuscular: "Brazos",
    }));
    mockAsignados.mockResolvedValue(asignados);
    mockBusqueda.mockResolvedValue([eje("v1", "Visible nuevo")]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderModal();
    await avanzarDebounce();
    expect(await screen.findByText("100 seleccionados")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seleccionar los visibles" }));

    expect(
      screen.getByText("Ya tenés 100 ejercicios seleccionados, el máximo por máquina")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Se seleccionaron los primeros 0/)).not.toBeInTheDocument();
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
