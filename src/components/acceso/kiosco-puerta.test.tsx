/**
 * Kiosco de puerta (T-036, D-43/D-47): misma mecánica DNI + PIN que recepción pero con el
 * token del dispositivo. El panel muestra SOLO nombre + estado y se limpia solo.
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KioscoPuerta } from "./kiosco-puerta";
import { accesoDispositivo } from "@/api/dispositivos";
import { ApiError } from "@/utils/api-error";

jest.mock("@/api/dispositivos", () => ({ accesoDispositivo: jest.fn() }));

const mockAcceso = accesoDispositivo as jest.MockedFunction<typeof accesoDispositivo>;
type User = ReturnType<typeof userEvent.setup>;

async function ingresarDni(user: User, dni: string) {
  for (const d of dni) await user.click(screen.getByRole("button", { name: d }));
  await user.click(screen.getByRole("button", { name: /continuar/i }));
}

async function ingresarPin(user: User, pin: string) {
  for (const d of pin) await user.click(screen.getByRole("button", { name: d }));
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("KioscoPuerta", () => {
  beforeEach(() => jest.clearAllMocks());

  it("envía DNI + PIN con el token del dispositivo y muestra nombre + estado", async () => {
    const user = userEvent.setup();
    mockAcceso.mockResolvedValueOnce({ resultado: "PERMITIDO", nombre: "Ana García" });
    render(<KioscoPuerta token="tok-dev" />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(mockAcceso).toHaveBeenCalledWith({ dni: "30123456", pin: "1111" }, "tok-dev");
    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("Acceso permitido")).toBeInTheDocument();
  });

  it("no muestra datos de más (ni plan ni estado de cuota)", async () => {
    const user = userEvent.setup();
    mockAcceso.mockResolvedValueOnce({ resultado: "PERMITIDO", nombre: "Ana García" });
    render(<KioscoPuerta token="tok-dev" />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByText("Gold")).not.toBeInTheDocument();
  });

  it("muestra el motivo cuando el acceso se deniega", async () => {
    const user = userEvent.setup();
    mockAcceso.mockResolvedValueOnce({ resultado: "DENEGADO", motivo: "Cuota vencida" });
    render(<KioscoPuerta token="tok-dev" />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(await screen.findByText("Cuota vencida")).toBeInTheDocument();
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
  });

  it("muestra el error de red/servidor (429) sin romper la pantalla", async () => {
    const user = userEvent.setup();
    mockAcceso.mockRejectedValueOnce(new ApiError(429, "Demasiados intentos"));
    render(<KioscoPuerta token="tok-dev" />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(await screen.findByText(/demasiados intentos/i)).toBeInTheDocument();
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
  });

  it("en 401 muestra un mensaje del dispositivo, no el de una sesión de usuario (AC-6)", async () => {
    const user = userEvent.setup();
    mockAcceso.mockRejectedValueOnce(new ApiError(401, "Dispositivo no autorizado"));
    render(<KioscoPuerta token="tok-dev" />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(
      await screen.findByText("Dispositivo no autorizado. Reconfigurá el token.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tu sesión venció/i)).not.toBeInTheDocument();
  });

  it("se limpia solo a los ~5 segundos y vuelve al inicio", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockAcceso.mockResolvedValueOnce({ resultado: "PERMITIDO", nombre: "Ana García" });
    render(<KioscoPuerta token="tok-dev" />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");
    expect(await screen.findByText("Ana García")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
    expect(screen.getByText(/ingresá tu dni/i)).toBeInTheDocument();

    jest.useRealTimers();
  });
});
