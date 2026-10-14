/**
 * Override en el kiosco de recepción (AC-3 / módulo 9): la denegación de un socio
 * conocido ofrece al ADMINISTRADOR otorgar acceso y el estado se refresca al otorgarlo.
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KioscoAcceso } from "./kiosco-acceso";
import { checkIn } from "@/api/acceso";
import { requestAccessOverride } from "@/api/socios/access-override";
import { useAuth } from "@/contexts/auth";
import { NotificationProvider } from "@/contexts/notifications";

jest.mock("@/api/acceso", () => ({ checkIn: jest.fn() }));
jest.mock("@/api/socios/access-override", () => ({ requestAccessOverride: jest.fn() }));
jest.mock("@/contexts/auth");

const mockCheckIn = checkIn as jest.MockedFunction<typeof checkIn>;
const mockRequest = requestAccessOverride as jest.MockedFunction<typeof requestAccessOverride>;
const mockAuth = useAuth as jest.Mock;

type User = ReturnType<typeof userEvent.setup>;

const DENEGADO_CON_SOCIO = {
  resultado: "DENEGADO",
  motivo: "Cuota vencida; requiere autorización",
  socio: { id: "socio-1", nombre: "Ana García", membresia: "Gold" },
} as const;

async function ingresar(user: User, dni: string, pin: string) {
  for (const d of dni) await user.click(screen.getByRole("button", { name: d }));
  await user.click(screen.getByRole("button", { name: /continuar/i }));
  for (const d of pin) await user.click(screen.getByRole("button", { name: d }));
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

function renderKiosco() {
  return render(
    <NotificationProvider>
      <KioscoAcceso />
    </NotificationProvider>
  );
}

describe("KioscoAcceso — override tras denegación", () => {
  beforeEach(() => jest.clearAllMocks());

  it("ADMINISTRADOR ve la acción y al otorgar refresca el estado a permitido", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "ADMINISTRADOR" }, isAuthenticated: true });
    mockCheckIn.mockResolvedValueOnce(DENEGADO_CON_SOCIO);
    mockRequest.mockResolvedValueOnce({
      success: true,
      message: "Acceso otorgado; registrado en auditoría",
    });
    const user = userEvent.setup();

    renderKiosco();
    await ingresar(user, "30123456", "1111");

    expect(await screen.findByText("Acceso denegado")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /otorgar acceso/i }));

    await user.type(screen.getByLabelText(/motivo/i), "Próximo pago confirmado");
    await user.click(screen.getByRole("button", { name: /^otorgar$/i }));

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith("socio-1", "Próximo pago confirmado")
    );
    expect(await screen.findByText("Acceso permitido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /otorgar acceso/i })).not.toBeInTheDocument();
  });

  it("RECEPCIONISTA no ve la acción de override", async () => {
    mockAuth.mockReturnValue({ user: { id: "u2", rol: "RECEPCIONISTA" }, isAuthenticated: true });
    mockCheckIn.mockResolvedValueOnce(DENEGADO_CON_SOCIO);
    const user = userEvent.setup();

    renderKiosco();
    await ingresar(user, "30123456", "1111");

    expect(await screen.findByText("Acceso denegado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /otorgar acceso/i })).not.toBeInTheDocument();
  });

  it("no ofrece override cuando la denegación no identifica al socio", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "ADMINISTRADOR" }, isAuthenticated: true });
    mockCheckIn.mockResolvedValueOnce({ resultado: "DENEGADO", motivo: "DNI o PIN incorrectos" });
    const user = userEvent.setup();

    renderKiosco();
    await ingresar(user, "00000000", "9999");

    expect(await screen.findByText("DNI o PIN incorrectos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /otorgar acceso/i })).not.toBeInTheDocument();
  });

  it("no limpia el resultado mientras el diálogo de override está abierto", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "ADMINISTRADOR" }, isAuthenticated: true });
    mockCheckIn.mockResolvedValueOnce(DENEGADO_CON_SOCIO);

    renderKiosco();
    await ingresar(user, "30123456", "1111");
    await user.click(await screen.findByRole("button", { name: /otorgar acceso/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    jest.useRealTimers();
  });
});
