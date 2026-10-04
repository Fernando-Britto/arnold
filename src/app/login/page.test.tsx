import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";
import { navigateTo } from "@/lib/navigation";

jest.mock("@/lib/navigation", () => ({ navigateTo: jest.fn() }));
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (navigateTo as jest.Mock).mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const res = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

async function submit() {
  const user = userEvent.setup();
  render(<LoginPage />);
  await user.type(screen.getByLabelText(/email/i), "a@arnold.gym");
  await user.type(screen.getByLabelText(/contraseña/i), "Secreta123");
  await user.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("LoginPage", () => {
  it.each([
    ["SOCIO", "/home-socio"],
    ["INSTRUCTOR", "/home-interno"],
    ["RECEPCIONISTA", "/home-interno"],
    ["ADMINISTRADOR", "/home-interno"],
  ])("login OK con rol %s navega a %s", async (role, dest) => {
    fetchMock.mockResolvedValue(res(200, { success: true, role }));
    await submit();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "a@arnold.gym", password: "Secreta123" }),
    }));
    expect(navigateTo).toHaveBeenCalledWith(dest);
  });

  it("401 muestra el mensaje del servidor y no navega", async () => {
    fetchMock.mockResolvedValue(res(401, { code: "AUTH_INVALID", message: "Email o contraseña incorrectos" }));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos");
    expect(navigateTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeEnabled();
  });

  it("429 muestra mensaje de demasiados intentos", async () => {
    fetchMock.mockResolvedValue(res(429, { error: "Too many login attempts." }));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/demasiados intentos/i);
  });

  it("error de red muestra mensaje genérico", async () => {
    fetchMock.mockRejectedValue(new Error("net"));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo conectar/i);
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
