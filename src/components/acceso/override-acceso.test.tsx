/**
 * Override de acceso (AC-3 / módulo 9): acción manual del ADMINISTRADOR tras una denegación.
 * Spec: openspec/specs/manual-override-authorization/spec.md (Override Confirmation Dialog).
 */
import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverrideAcceso, MOTIVO_MIN, MOTIVO_MAX } from "./override-acceso";
import { requestAccessOverride } from "@/api/socios/access-override";
import { useAuth } from "@/contexts/auth";
import { NotificationProvider } from "@/contexts/notifications";
import { ApiError } from "@/utils/api-error";

jest.mock("@/contexts/auth");
jest.mock("@/api/socios/access-override", () => ({ requestAccessOverride: jest.fn() }));

const mockAuth = useAuth as jest.Mock;
const mockRequest = requestAccessOverride as jest.MockedFunction<typeof requestAccessOverride>;

const SOCIO = { id: "socio-1", nombre: "Ana García", membresia: "Gold" };

type User = ReturnType<typeof userEvent.setup>;

function Harness({ onOtorgado }: { onOtorgado?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <NotificationProvider>
      <OverrideAcceso
        socio={SOCIO}
        motivoDenegacion="Cuota vencida; requiere autorización"
        abierto={abierto}
        onAbiertoChange={setAbierto}
        onOtorgado={onOtorgado ?? jest.fn()}
      />
    </NotificationProvider>
  );
}

function comoAdmin() {
  mockAuth.mockReturnValue({
    user: { id: "u1", rol: "ADMINISTRADOR" },
    isAuthenticated: true,
    isAdmin: true,
  });
}

async function abrirModal(user: User) {
  await user.click(screen.getByRole("button", { name: /otorgar acceso/i }));
  return screen.getByRole("dialog");
}

describe("OverrideAcceso — visibilidad por rol", () => {
  beforeEach(() => jest.clearAllMocks());

  it("no muestra la acción a un rol distinto de ADMINISTRADOR", () => {
    mockAuth.mockReturnValue({ user: { id: "u1", rol: "RECEPCIONISTA" }, isAuthenticated: true });

    render(<Harness />);

    expect(screen.queryByRole("button", { name: /otorgar acceso/i })).not.toBeInTheDocument();
  });

  it("muestra la acción al ADMINISTRADOR y abre el diálogo con el motivo de la denegación", async () => {
    comoAdmin();
    const user = userEvent.setup();

    render(<Harness />);
    const dialog = await abrirModal(user);

    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/motivo/i)).toBeInTheDocument();
    expect(screen.getByText(/cuota vencida/i)).toBeInTheDocument();
  });
});

describe("OverrideAcceso — validación del motivo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    comoAdmin();
  });

  it("deshabilita el envío y muestra error con menos de 10 caracteres", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await abrirModal(user);

    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "corto" } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      new RegExp(`al menos ${MOTIVO_MIN}`, "i")
    );
    expect(screen.getByRole("button", { name: /^otorgar$/i })).toBeDisabled();
  });

  it("habilita el envío con exactamente 10 caracteres", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await abrirModal(user);

    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "1234567890" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^otorgar$/i })).toBeEnabled();
  });

  it("rechaza motivos de más de 500 caracteres", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await abrirModal(user);

    fireEvent.change(screen.getByLabelText(/motivo/i), {
      target: { value: "a".repeat(MOTIVO_MAX + 1) },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      new RegExp(`no puede superar los ${MOTIVO_MAX}`, "i")
    );
    expect(screen.getByRole("button", { name: /^otorgar$/i })).toBeDisabled();
  });
});

describe("OverrideAcceso — envío", () => {
  beforeEach(() => jest.clearAllMocks());

  it("llama a requestAccessOverride(socioId, motivo), notifica, cierra y refresca", async () => {
    comoAdmin();
    mockRequest.mockResolvedValueOnce({
      success: true,
      message: "Acceso otorgado; registrado en auditoría",
    });
    const onOtorgado = jest.fn();
    const user = userEvent.setup();

    render(<Harness onOtorgado={onOtorgado} />);
    await abrirModal(user);

    fireEvent.change(screen.getByLabelText(/motivo/i), {
      target: { value: "Próximo pago confirmado" },
    });
    await user.click(screen.getByRole("button", { name: /^otorgar$/i }));

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith("socio-1", "Próximo pago confirmado")
    );
    expect(onOtorgado).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(/acceso otorgado/i)).toBeInTheDocument();
  });

  it("en error muestra el mensaje mapeado y mantiene el diálogo abierto", async () => {
    comoAdmin();
    mockRequest.mockRejectedValueOnce(new ApiError(403, "Se requiere rol de administrador"));
    const onOtorgado = jest.fn();
    const user = userEvent.setup();

    render(<Harness onOtorgado={onOtorgado} />);
    await abrirModal(user);

    fireEvent.change(screen.getByLabelText(/motivo/i), {
      target: { value: "Próximo pago confirmado" },
    });
    await user.click(screen.getByRole("button", { name: /^otorgar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no tenés permiso/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onOtorgado).not.toHaveBeenCalled();
  });
});
