/**
 * PagoForm (rediseño): elegir un cliente de la grilla, previsualizar el monto y registrar el pago.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PagoForm } from "./pago-form";
import { useNotifications } from "@/contexts/notifications";
import {
  fetchSocioPorId,
  fetchSociosPorNombre,
  type SocioBusqueda,
  type SocioResumen,
} from "@/api/socios";
import { createPago, fetchPagosDeSocio } from "@/api/pagos";
import { ApiError } from "@/utils/api-error";

jest.mock("@/contexts/notifications");
jest.mock("@/api/socios", () => ({
  fetchSociosPorNombre: jest.fn(),
  fetchSocioPorId: jest.fn(),
}));
jest.mock("@/api/pagos", () => ({
  createPago: jest.fn(),
  fetchPagosDeSocio: jest.fn(),
  anularPago: jest.fn(),
}));

const mockNotify = jest.fn();
const mockBuscar = fetchSociosPorNombre as jest.MockedFunction<typeof fetchSociosPorNombre>;
const mockSocioPorId = fetchSocioPorId as jest.MockedFunction<typeof fetchSocioPorId>;
const mockCreate = createPago as jest.MockedFunction<typeof createPago>;
const mockHistorial = fetchPagosDeSocio as jest.MockedFunction<typeof fetchPagosDeSocio>;

const resumen: SocioResumen = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  membresia: "Gold",
  fechaVencimiento: "2026-11-01T02:59:59.999Z",
  estadoCuota: "PENDIENTE",
};

const socio: SocioBusqueda = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: "+54 9 11 5555 5555",
  membresia: { id: "plan-gold", nombre: "Gold", precio: 30000 },
  estadoCuota: "PENDIENTE",
  fechaVencimiento: "2026-11-01T02:59:59.999Z",
  plan: {
    tipo: "RENOVACION",
    periodos: ["2026-11"],
    monto: 30000,
    cubreDesde: "2026-11-01T03:00:00.000Z",
    cubreHasta: "2026-11-30T02:59:59.999Z",
  },
  oferta: null,
};

const avanzar = (ms = 300) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

async function seleccionarCliente() {
  fireEvent.change(screen.getByLabelText("Buscar cliente por nombre o apellido"), {
    target: { value: "ana" },
  });
  await avanzar();
  fireEvent.click(await screen.findByText("Ana García"));
  await screen.findByRole("button", { name: "Registrar pago" });
}

describe("PagoForm", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    mockBuscar.mockResolvedValue({ items: [resumen], total: 1 });
    mockSocioPorId.mockResolvedValue(socio);
    // El historial se monta al elegir el cliente; sin pagos por defecto.
    mockHistorial.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it("elegir una fila muestra el panel y el formulario sin disparar el cobro", async () => {
    render(<PagoForm />);

    await seleccionarCliente();

    expect(screen.getByText("Cliente seleccionado")).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Cliente seleccionado" });
    expect(within(panel).getByText("Pendiente")).toBeInTheDocument();
    expect(within(panel).getByText("$ 30.000")).toBeInTheDocument();
    expect(mockSocioPorId).toHaveBeenCalledWith("socio-1");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("registra el pago con el monto esperado y notifica el éxito", async () => {
    mockCreate.mockResolvedValueOnce({
      pago: { id: "pago-1" },
      cuota: { id: "cuota-1" },
      plan: socio.plan,
      estadoCuota: "AL_DIA",
    } as never);
    render(<PagoForm />);

    await seleccionarCliente();
    fireEvent.change(screen.getByLabelText("Método de pago"), {
      target: { value: "TRANSFERENCIA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        socioId: "socio-1",
        metodoPago: "TRANSFERENCIA",
        montoEsperado: 30000,
      }),
    );
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringContaining("$ 30.000"));
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringContaining("2026-11"));
    // Se refresca el socio por id y el cliente sigue elegido.
    await waitFor(() => expect(mockSocioPorId).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Cliente seleccionado")).toBeInTheDocument();
    // El historial también se vuelve a pedir para mostrar el pago recién registrado.
    await waitFor(() => expect(mockHistorial).toHaveBeenCalledTimes(2));
  });

  it("con oferta envía el montoFinal mostrado", async () => {
    mockSocioPorId.mockResolvedValue({
      ...socio,
      oferta: { montoLista: 30000, descuentoPct: 10, montoFinal: 27000 },
    });
    mockCreate.mockResolvedValueOnce({
      pago: { id: "pago-1" },
      cuota: { id: "cuota-1" },
      plan: socio.plan,
      estadoCuota: "AL_DIA",
    } as never);
    render(<PagoForm />);

    await seleccionarCliente();
    expect(screen.getByText("$ 27.000")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        socioId: "socio-1",
        metodoPago: "EFECTIVO",
        montoEsperado: 27000,
      }),
    );
  });

  it("'Cambiar cliente' oculta el panel y conserva los resultados", async () => {
    render(<PagoForm />);

    await seleccionarCliente();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar cliente" }));

    expect(screen.queryByText("Cliente seleccionado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar pago" })).not.toBeInTheDocument();
    // La grilla sigue con el resultado de la búsqueda.
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("muestra el error de la API al registrar y no avisa éxito", async () => {
    mockCreate.mockRejectedValueOnce(new ApiError(400, "El socio no tiene una membresía asignada"));
    render(<PagoForm />);

    await seleccionarCliente();
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El socio no tiene una membresía asignada",
    );
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
  });

  it("con 409 AMOUNT_CHANGED refresca por id sin reintentar el cobro", async () => {
    mockCreate.mockRejectedValueOnce(
      new ApiError(409, "El monto cambió a 30000", "AMOUNT_CHANGED"),
    );
    render(<PagoForm />);

    await seleccionarCliente();
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El monto cambió a 30000");
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
    await waitFor(() => expect(mockSocioPorId).toHaveBeenCalledTimes(2));
    expect(mockSocioPorId).toHaveBeenLastCalledWith("socio-1");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("$ 30.000")).toBeInTheDocument();
  });
});
