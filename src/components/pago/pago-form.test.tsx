/**
 * PagoForm (T-033): buscar socio por DNI, previsualizar el monto y confirmar el pago.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PagoForm } from "./pago-form";
import { useNotifications } from "@/contexts/notifications";
import { fetchSocioPorDni } from "@/api/socios";
import { createPago, fetchPagosDeSocio } from "@/api/pagos";
import { ApiError } from "@/utils/api-error";

jest.mock("@/contexts/notifications");
jest.mock("@/api/socios", () => ({ fetchSocioPorDni: jest.fn() }));
jest.mock("@/api/pagos", () => ({ createPago: jest.fn(), fetchPagosDeSocio: jest.fn() }));

const mockNotify = jest.fn();
const mockFetch = fetchSocioPorDni as jest.MockedFunction<typeof fetchSocioPorDni>;
const mockCreate = createPago as jest.MockedFunction<typeof createPago>;
const mockHistorial = fetchPagosDeSocio as jest.MockedFunction<typeof fetchPagosDeSocio>;

const socio = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: "+54 9 11 5555 5555",
  membresia: { id: "plan-gold", nombre: "Gold", precio: 30000 },
  estadoCuota: "PENDIENTE" as const,
  plan: {
    tipo: "RENOVACION" as const,
    periodos: ["2026-11"],
    monto: 30000,
    cubreDesde: "2026-11-01T03:00:00.000Z",
    cubreHasta: "2026-11-30T02:59:59.999Z",
  },
  oferta: null,
};

async function buscarSocio(user: ReturnType<typeof userEvent.setup>) {
  mockFetch.mockResolvedValueOnce(socio);
  await user.type(screen.getByLabelText("DNI"), "30123456");
  await user.click(screen.getByRole("button", { name: /buscar/i }));
  await screen.findByText("Ana García");
}

describe("PagoForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
    // El historial se monta al encontrar el socio; sin pagos por defecto.
    mockHistorial.mockResolvedValue([]);
  });

  it("busca por DNI y muestra la tarjeta con estado de cuota y monto a cobrar", async () => {
    const user = userEvent.setup();
    render(<PagoForm />);

    await buscarSocio(user);

    expect(mockFetch).toHaveBeenCalledWith("30123456");
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("$ 30.000")).toBeInTheDocument();
  });

  it("muestra 'Socio no encontrado' cuando la búsqueda devuelve 404", async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValueOnce(new ApiError(404, "Socio no encontrado"));
    render(<PagoForm />);

    await user.type(screen.getByLabelText("DNI"), "00000000");
    await user.click(screen.getByRole("button", { name: /buscar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Socio no encontrado");
  });

  it("confirma el pago, avisa monto + período y resetea el formulario", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValueOnce({
      pago: { id: "pago-1" },
      cuota: { id: "cuota-1" },
      plan: socio.plan,
      estadoCuota: "AL_DIA",
    } as never);
    render(<PagoForm />);

    await buscarSocio(user);
    await user.selectOptions(screen.getByLabelText("Método de pago"), "TRANSFERENCIA");
    await user.click(screen.getByRole("button", { name: /confirmar pago/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        socioId: "socio-1",
        metodoPago: "TRANSFERENCIA",
        montoEsperado: 30000,
      })
    );
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringContaining("$ 30.000"));
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringContaining("2026-11"));
    await waitFor(() => expect(screen.queryByText("Ana García")).not.toBeInTheDocument());
    expect(screen.getByLabelText("DNI")).toHaveValue("");
  });

  it("con oferta envía el montoFinal mostrado como montoEsperado", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
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

    await user.type(screen.getByLabelText("DNI"), "30123456");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    await screen.findByText("Ana García");
    expect(screen.getByText("$ 27.000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirmar pago/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        socioId: "socio-1",
        metodoPago: "EFECTIVO",
        montoEsperado: 27000,
      })
    );
  });

  it("con 409 AMOUNT_CHANGED avisa y refresca la vista previa sin reintentar el cobro", async () => {
    const user = userEvent.setup();
    mockCreate.mockRejectedValueOnce(
      new ApiError(409, "El monto cambió a 30000", "AMOUNT_CHANGED")
    );
    render(<PagoForm />);

    await buscarSocio(user);
    mockFetch.mockResolvedValueOnce(socio); // el refresco trae el socio con el monto vigente

    await user.click(screen.getByRole("button", { name: /confirmar pago/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El monto cambió a 30000");
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2)); // se re-buscó por DNI
    expect(mockFetch).toHaveBeenLastCalledWith("30123456");
    expect(mockCreate).toHaveBeenCalledTimes(1); // no se reintentó el cobro
    expect(screen.getByText("$ 30.000")).toBeInTheDocument();
  });

  it("muestra el error de la API al confirmar y no avisa éxito", async () => {
    const user = userEvent.setup();
    mockCreate.mockRejectedValueOnce(new ApiError(400, "El socio no tiene una membresía asignada"));
    render(<PagoForm />);

    await buscarSocio(user);
    await user.click(screen.getByRole("button", { name: /confirmar pago/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El socio no tiene una membresía asignada"
    );
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
  });
});
