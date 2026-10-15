/**
 * PagosHistorial (P-39): historial de pagos con la acción de anular.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PagosHistorial } from "./pagos-historial";
import { useNotifications } from "@/contexts/notifications";
import { fetchPagosDeSocio, anularPago } from "@/api/pagos";
import { ApiError } from "@/utils/api-error";

jest.mock("@/contexts/notifications");
jest.mock("@/api/pagos", () => ({ fetchPagosDeSocio: jest.fn(), anularPago: jest.fn() }));

const mockNotify = jest.fn();
const mockFetch = fetchPagosDeSocio as jest.MockedFunction<typeof fetchPagosDeSocio>;
const mockAnular = anularPago as jest.MockedFunction<typeof anularPago>;

const CONFIRMADO = {
  id: "pago-1",
  fechaPago: "2026-11-15T10:00:00.000Z",
  monto: "30000",
  metodoPago: "EFECTIVO",
  estado: "CONFIRMADO" as const,
  cuotaId: "cuota-1",
};
const ANULADO = { ...CONFIRMADO, id: "pago-2", estado: "ANULADO" as const };

describe("PagosHistorial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
  });

  it("muestra el historial y no ofrece anular un pago ya anulado", async () => {
    mockFetch.mockResolvedValue([CONFIRMADO, ANULADO]);
    render(<PagosHistorial socioId="socio-1" />);

    expect(await screen.findByText("Confirmado")).toBeInTheDocument();
    expect(screen.getByText("Anulado")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /anular/i })).toHaveLength(1);
  });

  it("pide el motivo, confirma, avisa y refresca la lista", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce([CONFIRMADO]).mockResolvedValueOnce([ANULADO]);
    mockAnular.mockResolvedValueOnce({ pago: { id: "pago-1" }, cuotaEliminada: "cuota-1" });
    const onAnulado = jest.fn();
    render(<PagosHistorial socioId="socio-1" onAnulado={onAnulado} />);

    await user.click(await screen.findByRole("button", { name: "Anular" }));
    await user.type(screen.getByLabelText("Motivo de la anulación"), "cobro por error");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mockAnular).toHaveBeenCalledWith("pago-1", "cobro por error"));
    expect(mockNotify).toHaveBeenCalledWith("success", "Pago anulado.");
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(onAnulado).toHaveBeenCalled();
  });

  it("sin motivo no llama a la API", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue([CONFIRMADO]);
    render(<PagosHistorial socioId="socio-1" />);

    await user.click(await screen.findByRole("button", { name: "Anular" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/motivo es obligatorio/i);
    expect(mockAnular).not.toHaveBeenCalled();
  });

  it("muestra el error de la API al anular", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue([CONFIRMADO]);
    mockAnular.mockRejectedValueOnce(
      new ApiError(409, "El pago ya está anulado", "PAYMENT_ALREADY_ANNULLED")
    );
    render(<PagosHistorial socioId="socio-1" />);

    await user.click(await screen.findByRole("button", { name: "Anular" }));
    await user.type(screen.getByLabelText("Motivo de la anulación"), "x");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El pago ya está anulado");
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.anything());
  });
});
