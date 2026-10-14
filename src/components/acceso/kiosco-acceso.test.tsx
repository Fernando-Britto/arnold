/**
 * Kiosco de acceso (T-035, D-47): teclado numérico para DNI y PIN, panel de resultado
 * que se limpia solo y vuelve al inicio.
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KioscoAcceso } from "./kiosco-acceso";
import { checkIn } from "@/api/acceso";
import { ApiError } from "@/utils/api-error";

jest.mock("@/api/acceso", () => ({ checkIn: jest.fn() }));

const mockCheckIn = checkIn as jest.MockedFunction<typeof checkIn>;

type User = ReturnType<typeof userEvent.setup>;

async function ingresarDni(user: User, dni: string) {
  for (const d of dni) await user.click(screen.getByRole("button", { name: d }));
  await user.click(screen.getByRole("button", { name: /continuar/i }));
}

async function ingresarPin(user: User, pin: string) {
  for (const d of pin) await user.click(screen.getByRole("button", { name: d }));
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("KioscoAcceso", () => {
  beforeEach(() => jest.clearAllMocks());

  it("permite ingresar DNI y PIN con el teclado y muestra el acceso permitido", async () => {
    const user = userEvent.setup();
    mockCheckIn.mockResolvedValueOnce({
      resultado: "PERMITIDO",
      socio: { id: "socio-1", nombre: "Ana García", membresia: "Gold" },
      estadoCuota: "AL_DIA",
    });
    render(<KioscoAcceso />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(mockCheckIn).toHaveBeenCalledWith({ dni: "30123456", pin: "1111" });
    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("Acceso permitido")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
  });

  it("muestra el aviso cuando la cuota está pendiente", async () => {
    const user = userEvent.setup();
    mockCheckIn.mockResolvedValueOnce({
      resultado: "PERMITIDO_CON_AVISO",
      motivo: "Cuota a pagar hasta el día 10",
      socio: { id: "socio-1", nombre: "Ana García", membresia: "Gold" },
      estadoCuota: "PENDIENTE",
    });
    render(<KioscoAcceso />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(await screen.findByText("Cuota a pagar hasta el día 10")).toBeInTheDocument();
    expect(screen.getByText(/con aviso/i)).toBeInTheDocument();
  });

  it("muestra el motivo genérico cuando el DNI o el PIN son incorrectos", async () => {
    const user = userEvent.setup();
    mockCheckIn.mockResolvedValueOnce({ resultado: "DENEGADO", motivo: "DNI o PIN incorrectos" });
    render(<KioscoAcceso />);

    await ingresarDni(user, "00000000");
    await ingresarPin(user, "9999");

    expect(await screen.findByText("DNI o PIN incorrectos")).toBeInTheDocument();
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
  });

  it("muestra el error de red/servidor (429) sin romper la pantalla", async () => {
    const user = userEvent.setup();
    mockCheckIn.mockRejectedValueOnce(new ApiError(429, "Demasiados intentos"));
    render(<KioscoAcceso />);

    await ingresarDni(user, "30123456");
    await ingresarPin(user, "1111");

    expect(await screen.findByText(/demasiados intentos/i)).toBeInTheDocument();
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
  });

  it("se limpia solo a los ~5 segundos y vuelve al inicio para el próximo socio", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockCheckIn.mockResolvedValueOnce({
      resultado: "PERMITIDO",
      socio: { id: "socio-1", nombre: "Ana García", membresia: "Gold" },
      estadoCuota: "AL_DIA",
    });
    render(<KioscoAcceso />);

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

  it("no permite enviar el PIN hasta tener 4 dígitos", async () => {
    const user = userEvent.setup();
    render(<KioscoAcceso />);

    await ingresarDni(user, "30123456");
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByRole("button", { name: /ingresar/i })).toBeDisabled();
    expect(mockCheckIn).not.toHaveBeenCalled();
  });
});
