/**
 * Panel de huella del socio seleccionado en /clientes (T-041): sin huella, con huella,
 * enrolamiento pendiente que el polling resuelve, y consentimiento obligatorio.
 */
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PanelHuella } from "./panel-huella";
import {
  eliminarHuella,
  fetchEstadoHuella,
  registrarHuella,
  type EstadoHuella,
} from "@/api/huellas-client";
import { useNotifications } from "@/contexts/notifications";

jest.mock("@/api/huellas-client", () => ({
  fetchEstadoHuella: jest.fn(),
  registrarHuella: jest.fn(),
  eliminarHuella: jest.fn(),
}));
jest.mock("@/contexts/notifications");

const mockFetch = fetchEstadoHuella as jest.MockedFunction<typeof fetchEstadoHuella>;
const mockRegistrar = registrarHuella as jest.MockedFunction<typeof registrarHuella>;
const mockEliminar = eliminarHuella as jest.MockedFunction<typeof eliminarHuella>;
const mockNotify = jest.fn();

const sinHuella: EstadoHuella = { huellaId: null, consentimientoEn: null, solicitud: null };
const conHuella: EstadoHuella = {
  huellaId: 7,
  consentimientoEn: "2026-10-16T10:00:00.000Z",
  solicitud: null,
};

function solicitud(parcial: Partial<EstadoHuella["solicitud"]>): EstadoHuella["solicitud"] {
  return {
    id: "solicitud-1",
    accion: "ENROLAR",
    huellaId: 5,
    estado: "PENDIENTE",
    motivo: null,
    duplicadoDe: null,
    createdAt: "2026-10-16T10:00:00.000Z",
    resueltaEn: null,
    ...parcial,
  };
}

describe("PanelHuella", () => {
  beforeEach(() => {
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
  });

  it("sin huella: el alta está bloqueada hasta marcar el consentimiento", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(sinHuella);
    render(<PanelHuella socioId="socio-1" />);

    const boton = await screen.findByRole("button", { name: /registrar huella/i });
    expect(boton).toBeDisabled();

    await user.click(screen.getByLabelText(/consentimiento informado/i));
    expect(boton).toBeEnabled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it("registra la huella con el consentimiento marcado", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(sinHuella);
    mockRegistrar.mockResolvedValueOnce(undefined);
    mockFetch.mockResolvedValueOnce({ ...sinHuella, solicitud: solicitud({}) });
    render(<PanelHuella socioId="socio-1" />);

    await user.click(await screen.findByLabelText(/consentimiento informado/i));
    await user.click(screen.getByRole("button", { name: /registrar huella/i }));

    await waitFor(() => expect(mockRegistrar).toHaveBeenCalledWith("socio-1"));
    expect(await screen.findByText(/esperando al sensor/i)).toBeInTheDocument();
  });

  it("con huella: muestra el ID y elimina tras confirmar", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(conHuella);
    mockEliminar.mockResolvedValueOnce(undefined);
    mockFetch.mockResolvedValueOnce({
      huellaId: 7,
      consentimientoEn: conHuella.consentimientoEn,
      solicitud: solicitud({ accion: "BORRAR", huellaId: 7 }),
    });
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    render(<PanelHuella socioId="socio-1" />);

    expect(await screen.findByText(/huella registrada \(id 7\)/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /eliminar huella/i }));

    await waitFor(() => expect(mockEliminar).toHaveBeenCalledWith("socio-1"));
    confirmSpy.mockRestore();
  });

  it("no elimina si se cancela la confirmación", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(conHuella);
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<PanelHuella socioId="socio-1" />);

    await user.click(await screen.findByRole("button", { name: /eliminar huella/i }));
    expect(mockEliminar).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("con solicitud pendiente hace polling y muestra el resultado confirmado", async () => {
    jest.useFakeTimers();
    try {
      mockFetch
        .mockResolvedValueOnce({ ...sinHuella, solicitud: solicitud({}) })
        .mockResolvedValueOnce({
          huellaId: 5,
          consentimientoEn: "2026-10-16T10:00:00.000Z",
          solicitud: solicitud({ estado: "CONFIRMADA", resueltaEn: "2026-10-16T10:00:05.000Z" }),
        });

      render(<PanelHuella socioId="socio-1" />);
      expect(await screen.findByText(/esperando al sensor/i)).toBeInTheDocument();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(await screen.findByText(/huella registrada \(id 5\)/i)).toBeInTheDocument();
      expect(mockNotify).toHaveBeenCalledWith("success", expect.stringMatching(/huella registrada/i));
    } finally {
      jest.useRealTimers();
    }
  });

  it("con solicitud fallida muestra el motivo legible", async () => {
    mockFetch.mockResolvedValueOnce({
      ...sinHuella,
      solicitud: solicitud({ estado: "FALLIDA", motivo: "duplicado", resueltaEn: "2026-10-16T10:00:05.000Z" }),
    });
    render(<PanelHuella socioId="socio-1" />);

    expect(await screen.findByText(/esa huella ya estaba registrada/i)).toBeInTheDocument();
  });
});
