/**
 * ClienteBusqueda: buscador por nombre con debounce, grilla paginada y fila seleccionable.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClienteBusqueda } from "./cliente-busqueda";
import { fetchSociosPorNombre, type BusquedaSociosResultado, type SocioResumen } from "@/api/socios";

jest.mock("@/api/socios", () => ({ fetchSociosPorNombre: jest.fn() }));

const mockFetch = fetchSociosPorNombre as jest.MockedFunction<typeof fetchSociosPorNombre>;

const socio = (id: string, nombre: string, overrides: Partial<SocioResumen> = {}): SocioResumen => ({
  id,
  nombre,
  dni: "30123456",
  membresia: "Gold",
  fechaVencimiento: "2026-11-01T02:59:59.999Z",
  estadoCuota: "PENDIENTE",
  ...overrides,
});

const pagina = (cantidad: number): SocioResumen[] =>
  Array.from({ length: cantidad }, (_, i) => socio(`p${i}`, `Cliente ${i}`));

const avanzar = (ms = 300) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

const escribir = (texto: string) =>
  fireEvent.change(screen.getByLabelText("Buscar cliente por nombre o apellido"), {
    target: { value: texto },
  });

function diferido<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const renderBusqueda = (props: Partial<React.ComponentProps<typeof ClienteBusqueda>> = {}) =>
  render(<ClienteBusqueda seleccionadoId={null} onSeleccionar={jest.fn()} {...props} />);

describe("ClienteBusqueda", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("muestra la pista inicial sin consultar la API", async () => {
    renderBusqueda();
    await avanzar();

    expect(
      screen.getByText("Ingrese un nombre o apellido para buscar un cliente."),
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("debouncea 300 ms y consulta el texto recortado", async () => {
    mockFetch.mockResolvedValue({ items: [], total: 0 });
    renderBusqueda();

    escribir("  ana  ");
    await avanzar(299);
    expect(mockFetch).not.toHaveBeenCalled();

    await avanzar(1);
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith({ q: "ana", limit: 10, offset: 0 }),
    );
  });

  it("renderiza columnas y filas con DNI, membresía, vencimiento y estado", async () => {
    mockFetch.mockResolvedValue({
      items: [socio("socio-1", "Ana García")],
      total: 1,
    });
    renderBusqueda();

    escribir("ana");
    await avanzar();

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    for (const columna of ["Cliente", "DNI", "Membresía", "Vencimiento", "Estado"]) {
      expect(screen.getByText(columna)).toBeInTheDocument();
    }
    expect(screen.getByText("30.123.456")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("31/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("al hacer clic en una fila la selecciona", async () => {
    const onSeleccionar = jest.fn();
    mockFetch.mockResolvedValue({ items: [socio("socio-1", "Ana García")], total: 1 });
    renderBusqueda({ onSeleccionar });

    escribir("ana");
    await avanzar();
    fireEvent.click(await screen.findByText("Ana García"));

    expect(onSeleccionar).toHaveBeenCalledWith(socio("socio-1", "Ana García"));
  });

  it("Enter y Espacio también seleccionan la fila", async () => {
    const onSeleccionar = jest.fn();
    mockFetch.mockResolvedValue({ items: [socio("socio-1", "Ana García")], total: 1 });
    renderBusqueda({ onSeleccionar });

    escribir("ana");
    await avanzar();
    const fila = (await screen.findByText("Ana García")).closest('[role="row"]') as HTMLElement;

    fireEvent.keyDown(fila, { key: "Enter" });
    fireEvent.keyDown(fila, { key: " " });

    expect(onSeleccionar).toHaveBeenCalledTimes(2);
    expect(onSeleccionar).toHaveBeenCalledWith(socio("socio-1", "Ana García"));
  });

  it("muestra el estado vacío cuando no hay coincidencias", async () => {
    mockFetch.mockResolvedValue({ items: [], total: 0 });
    renderBusqueda();

    escribir("zzz");
    await avanzar();

    expect(
      await screen.findByText("No encontramos clientes con ese nombre."),
    ).toBeInTheDocument();
    expect(screen.getByText("Verificá la escritura o intentá con otro nombre.")).toBeInTheDocument();
  });

  it("muestra el error y reintenta", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));
    renderBusqueda();

    escribir("ana");
    await avanzar();

    expect(await screen.findByText("No se pudieron cargar los clientes.")).toBeInTheDocument();

    mockFetch.mockResolvedValueOnce({ items: [socio("socio-1", "Ana García")], total: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("el botón de limpiar vuelve a la pista inicial", async () => {
    mockFetch.mockResolvedValue({ items: [socio("socio-1", "Ana García")], total: 1 });
    renderBusqueda();

    escribir("ana");
    await avanzar();
    expect(await screen.findByText("Ana García")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));

    expect(
      screen.getByText("Ingrese un nombre o apellido para buscar un cliente."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
  });

  it("pagina de 10 en 10 conservando la consulta", async () => {
    mockFetch
      .mockResolvedValueOnce({ items: pagina(10), total: 25 })
      .mockResolvedValueOnce({
        items: Array.from({ length: 10 }, (_, i) => socio(`q${i}`, `Otro ${i}`)),
        total: 25,
      });
    renderBusqueda();

    escribir("cliente");
    await avanzar();
    expect(await screen.findByText("Mostrando 1–10 de 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith({ q: "cliente", limit: 10, offset: 10 }),
    );
    expect(await screen.findByText("Mostrando 11–20 de 25")).toBeInTheDocument();
  });

  it("descarta una respuesta vieja que llega después de una nueva", async () => {
    const primera = diferido<BusquedaSociosResultado>();
    const segunda = diferido<BusquedaSociosResultado>();
    mockFetch.mockReturnValueOnce(primera.promise).mockReturnValueOnce(segunda.promise);
    renderBusqueda();

    escribir("ana");
    await avanzar();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    escribir("ana b");
    await avanzar();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    await act(async () => {
      segunda.resolve({ items: [socio("n", "Cliente nuevo")], total: 1 });
    });
    expect(await screen.findByText("Cliente nuevo")).toBeInTheDocument();

    await act(async () => {
      primera.resolve({ items: [socio("v", "Cliente viejo")], total: 1 });
    });
    await waitFor(() => expect(screen.queryByText("Cliente viejo")).not.toBeInTheDocument());
    expect(screen.getByText("Cliente nuevo")).toBeInTheDocument();
  });
});
