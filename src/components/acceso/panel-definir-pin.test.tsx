/**
 * Panel "Definir PIN" de /acceso (T-035, D-47): búsqueda por DNI, alta del PIN de 4 dígitos
 * y notificación de éxito. Separado del kiosco de check-in para que no lo use un socio.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PanelDefinirPin } from "./panel-definir-pin";
import { fetchSocioPorDni } from "@/api/socios";
import { setPin } from "@/api/acceso";
import { useNotifications } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";

jest.mock("@/api/socios", () => ({ fetchSocioPorDni: jest.fn() }));
jest.mock("@/api/acceso", () => ({ setPin: jest.fn() }));
jest.mock("@/contexts/notifications");

const mockBuscar = fetchSocioPorDni as jest.MockedFunction<typeof fetchSocioPorDni>;
const mockSetPin = setPin as jest.MockedFunction<typeof setPin>;
const mockNotify = jest.fn();

const socio = {
  id: "socio-1",
  nombre: "Ana García",
  dni: "30123456",
  email: "ana@example.com",
  telefono: null,
  membresia: { id: "gold-1", nombre: "Gold", precio: 30000 },
  estadoCuota: "PENDIENTE" as const,
  plan: null,
};

type User = ReturnType<typeof userEvent.setup>;

async function buscar(user: User, dni = "30123456") {
  await user.type(screen.getByLabelText(/DNI/i), dni);
  await user.click(screen.getByRole("button", { name: /buscar/i }));
}

describe("PanelDefinirPin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNotifications as jest.Mock).mockReturnValue({ notify: mockNotify, dismiss: jest.fn() });
  });

  it("busca el socio por DNI y muestra nombre y membresía", async () => {
    const user = userEvent.setup();
    mockBuscar.mockResolvedValueOnce(socio);
    render(<PanelDefinirPin />);

    await buscar(user);

    expect(mockBuscar).toHaveBeenCalledWith("30123456");
    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
  });

  it("define el PIN del socio, notifica el éxito y se reinicia", async () => {
    const user = userEvent.setup();
    mockBuscar.mockResolvedValueOnce(socio);
    mockSetPin.mockResolvedValueOnce({ success: true });
    render(<PanelDefinirPin />);

    await buscar(user);
    await user.type(await screen.findByLabelText("PIN (4 dígitos)"), "4821");
    await user.click(screen.getByRole("button", { name: /guardar pin/i }));

    await waitFor(() => expect(mockSetPin).toHaveBeenCalledWith("socio-1", "4821"));
    expect(mockNotify).toHaveBeenCalledWith("success", expect.stringMatching(/PIN/i));
    await waitFor(() => expect(screen.queryByText("Ana García")).not.toBeInTheDocument());
  });

  it("no permite guardar hasta tener 4 dígitos", async () => {
    const user = userEvent.setup();
    mockBuscar.mockResolvedValueOnce(socio);
    render(<PanelDefinirPin />);

    await buscar(user);
    await user.type(await screen.findByLabelText("PIN (4 dígitos)"), "12");

    expect(screen.getByRole("button", { name: /guardar pin/i })).toBeDisabled();
    expect(mockSetPin).not.toHaveBeenCalled();
  });

  it("muestra el error cuando el DNI no existe", async () => {
    const user = userEvent.setup();
    mockBuscar.mockRejectedValueOnce(new ApiError(404, "Socio no encontrado"));
    render(<PanelDefinirPin />);

    await buscar(user, "00000000");

    expect(await screen.findByRole("alert")).toHaveTextContent(/Socio no encontrado/i);
  });

  it("muestra el error cuando falla definir el PIN", async () => {
    const user = userEvent.setup();
    mockBuscar.mockResolvedValueOnce(socio);
    mockSetPin.mockRejectedValueOnce(new ApiError(400, "El PIN debe tener exactamente 4 dígitos"));
    render(<PanelDefinirPin />);

    await buscar(user);
    await user.type(await screen.findByLabelText("PIN (4 dígitos)"), "4821");
    await user.click(screen.getByRole("button", { name: /guardar pin/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/exactamente 4 dígitos/i);
    expect(mockNotify).not.toHaveBeenCalledWith("success", expect.any(String));
  });
});
